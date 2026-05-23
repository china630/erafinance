import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EarlyAccessEventType,
  EarlyAccessModuleKey,
  NotificationSeverity,
  Prisma,
} from "@erafinance/database";
import type { Request } from "express";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import type { AuthUser } from "../auth/types/auth-user";
import type { EarlyAccessSignupDto } from "./dto/signup.dto";
import type { RecordEarlyAccessEventDto } from "./dto/record-event.dto";

const ALL_MODULE_KEYS: EarlyAccessModuleKey[] = [
  EarlyAccessModuleKey.RETAIL_ECOM,
  EarlyAccessModuleKey.LOGISTICS_CUSTOMS,
  EarlyAccessModuleKey.CONSTRUCTION,
  EarlyAccessModuleKey.CRM_WHATSAPP,
];

function parseThresholds(raw: string | undefined): number[] {
  const s = (raw ?? "50,100").trim();
  const parts = s.split(",").map((p) => Number.parseInt(p.trim(), 10));
  return [...new Set(parts.filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  );
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

function hoursBetween(from: Date, to: Date): number {
  return Math.max((to.getTime() - from.getTime()) / 3_600_000, 1 / 3600);
}

@Injectable()
export class EarlyAccessService {
  private readonly logger = new Logger(EarlyAccessService.name);
  private readonly thresholds: number[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: SubscriptionAccessService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.thresholds = parseThresholds(
      this.config.get<string>("EARLY_ACCESS_THRESHOLDS"),
    );
  }

  requireOrg(user: AuthUser): string {
    if (user.isSuperAdmin && !user.organizationId) {
      throw new ForbiddenException(
        "Select an organization context to use industry solutions waitlist.",
      );
    }
    if (!user.organizationId) {
      throw new ForbiddenException(
        "Organization context required for early access signup.",
      );
    }
    return user.organizationId;
  }

  private getClientMeta(req: Request): { clientIp: string | null; userAgent: string | null } {
    const forwarded = req.headers["x-forwarded-for"];
    const ipFromForwarded =
      typeof forwarded === "string"
        ? forwarded.split(",")[0]?.trim() ?? null
        : null;
    const clientIp = ipFromForwarded ?? req.ip ?? null;
    const ua = req.headers["user-agent"];
    const userAgent = typeof ua === "string" ? ua.slice(0, 512) : null;
    return { clientIp, userAgent };
  }

  private async industrySnapshotForOrg(
    organizationId: string,
  ): Promise<string | null> {
    const row = await this.prisma.earlyAccessSignup.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      select: { industry: true },
    });
    return row?.industry ?? null;
  }

  async recordEvent(
    user: AuthUser,
    dto: RecordEarlyAccessEventDto,
    req: Request,
  ): Promise<{ ok: true }> {
    const organizationId = this.requireOrg(user);
    if (
      dto.eventType === EarlyAccessEventType.MODAL_CLOSE &&
      (dto.durationMs == null || dto.durationMs < 0)
    ) {
      throw new BadRequestException("durationMs is required for MODAL_CLOSE");
    }

    const snap = await this.access.getOrganizationSnapshot(organizationId);
    const industrySnapshot = await this.industrySnapshotForOrg(organizationId);
    const { clientIp, userAgent } = this.getClientMeta(req);

    await this.prisma.earlyAccessEvent.create({
      data: {
        moduleKey: dto.moduleKey,
        eventType: dto.eventType,
        userId: user.userId,
        organizationId,
        subscriptionTier: snap.tier,
        industrySnapshot,
        sessionId: dto.sessionId,
        durationMs: dto.durationMs ?? null,
        metadata: dto.metadata
          ? (dto.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        clientIp,
        userAgent,
      },
    });
    return { ok: true };
  }

  async signup(
    user: AuthUser,
    dto: EarlyAccessSignupDto,
    req: Request,
  ): Promise<{ ok: true; created: boolean }> {
    const organizationId = this.requireOrg(user);
    const snap = await this.access.getOrganizationSnapshot(organizationId);
    const { clientIp, userAgent } = this.getClientMeta(req);

    const existing = await this.prisma.earlyAccessSignup.findUnique({
      where: {
        moduleKey_organizationId: {
          moduleKey: dto.moduleKey,
          organizationId,
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.earlyAccessSignup.upsert({
        where: {
          moduleKey_organizationId: {
            moduleKey: dto.moduleKey,
            organizationId,
          },
        },
        create: {
          moduleKey: dto.moduleKey,
          userId: user.userId,
          organizationId,
          subscriptionTier: snap.tier,
          industry: dto.industry,
          surveyAnswer: dto.surveyAnswer?.trim() || null,
        },
        update: {
          userId: user.userId,
          subscriptionTier: snap.tier,
          industry: dto.industry,
          surveyAnswer: dto.surveyAnswer?.trim() || null,
        },
      });

      await tx.earlyAccessEvent.create({
        data: {
          moduleKey: dto.moduleKey,
          eventType: EarlyAccessEventType.SURVEY_SUBMIT,
          userId: user.userId,
          organizationId,
          subscriptionTier: snap.tier,
          industrySnapshot: dto.industry,
          sessionId: crypto.randomUUID(),
          metadata: dto.surveyAnswer
            ? ({ surveyLen: dto.surveyAnswer.length } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          clientIp,
          userAgent,
        },
      });
    });

    const count = await this.prisma.earlyAccessSignup.count({
      where: { moduleKey: dto.moduleKey },
    });

    await this.maybeFireThresholdAlerts(dto.moduleKey, count);

    return { ok: true, created: !existing };
  }

  private async maybeFireThresholdAlerts(
    moduleKey: EarlyAccessModuleKey,
    count: number,
  ): Promise<void> {
    for (const T of this.thresholds) {
      if (count < T) continue;
      try {
        await this.prisma.earlyAccessThresholdAlert.create({
          data: {
            moduleKey,
            threshold: T,
            firedToCount: count,
          },
        });
        await this.notifySuperAdmins(moduleKey, T, count);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        this.logger.warn(
          `maybeFireThresholdAlerts: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  private async notifySuperAdmins(
    moduleKey: EarlyAccessModuleKey,
    threshold: number,
    count: number,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { isSuperAdmin: true },
      select: { id: true, email: true },
    });
    const subject = `ERA Finance — early access threshold ${threshold} (${moduleKey})`;
    const text = `Industry module ${moduleKey} reached ${count} organization signups (threshold ${threshold}).\nReview: Super Admin → Industry waitlist.`;

    for (const a of admins) {
      if (a.email) {
        await this.mail
          .sendMail({ to: a.email, subject, text })
          .catch((err: unknown) =>
            this.logger.warn(
              `notifySuperAdmins mail: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }
      await this.prisma.notification
        .create({
          data: {
            userId: a.id,
            organizationId: null,
            title: subject,
            message: text,
            severity: NotificationSeverity.INFO,
            link: "/super-admin",
          },
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `notifySuperAdmins notification: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }
  }

  async listMine(organizationId: string) {
    return this.prisma.earlyAccessSignup.findMany({
      where: { organizationId },
      select: {
        moduleKey: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getAdminSummary() {
    const signupsByModule = await this.prisma.earlyAccessSignup.groupBy({
      by: ["moduleKey"],
      _count: { _all: true },
      _min: { createdAt: true },
    });
    const signupMap = new Map(
      signupsByModule.map((r) => [
        r.moduleKey,
        { count: r._count._all, firstAt: r._min.createdAt },
      ]),
    );

    const viewerRows = await this.prisma.$queryRaw<
      Array<{ module_key: EarlyAccessModuleKey; c: bigint }>
    >`
      SELECT module_key, COUNT(DISTINCT user_id)::bigint AS c
      FROM early_access_events
      WHERE event_type = 'VIEW_CLICK' AND user_id IS NOT NULL
      GROUP BY module_key
    `;
    const viewersMap = new Map(
      viewerRows.map((r) => [r.module_key, Number(r.c)]),
    );

    const closeEvents = await this.prisma.earlyAccessEvent.findMany({
      where: {
        eventType: EarlyAccessEventType.MODAL_CLOSE,
        durationMs: { not: null },
      },
      select: { moduleKey: true, durationMs: true },
    });
    const durationsByModule = new Map<EarlyAccessModuleKey, number[]>();
    for (const e of closeEvents) {
      if (e.durationMs == null) continue;
      const arr = durationsByModule.get(e.moduleKey) ?? [];
      arr.push(e.durationMs);
      durationsByModule.set(e.moduleKey, arr);
    }

    const alerts = await this.prisma.earlyAccessThresholdAlert.findMany();
    const alertSet = new Set(alerts.map((a) => `${a.moduleKey}:${a.threshold}`));

    const now = new Date();
    const summaries = ALL_MODULE_KEYS.map((moduleKey) => {
      const su = signupMap.get(moduleKey);
      const signupsCount = su?.count ?? 0;
      const firstSignupAt = su?.firstAt ?? null;
      const viewersCount = viewersMap.get(moduleKey) ?? 0;
      const conversionRate =
        viewersCount > 0 ? signupsCount / viewersCount : signupsCount > 0 ? 1 : 0;
      const med = median(durationsByModule.get(moduleKey) ?? []);
      const hours = firstSignupAt
        ? hoursBetween(firstSignupAt, now)
        : null;
      const signupsPerHour =
        hours != null && signupsCount > 0 ? signupsCount / hours : 0;

      const thresholdsHit = this.thresholds.filter((T) =>
        alertSet.has(`${moduleKey}:${T}`),
      );

      return {
        moduleKey,
        signupsCount,
        viewersCount,
        conversionRate,
        medianModalCloseMs: med,
        firstSignupAt,
        signupsPerHour,
        thresholdsHit,
      };
    });

    const ranked = [...summaries].sort(
      (a, b) => b.signupsPerHour - a.signupsPerHour,
    );
    const rankByModule = new Map(
      ranked.map((s, i) => [s.moduleKey, i + 1]),
    );

    return summaries.map((s) => ({
      ...s,
      speedRank: rankByModule.get(s.moduleKey) ?? 0,
    }));
  }

  async getAdminEvents(params: {
    moduleKey?: EarlyAccessModuleKey;
    page: number;
    pageSize: number;
  }) {
    const { moduleKey, page, pageSize } = params;
    const where = moduleKey ? { moduleKey } : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.earlyAccessEvent.count({ where }),
      this.prisma.earlyAccessEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({
        id: r.id,
        moduleKey: r.moduleKey,
        eventType: r.eventType,
        userId: r.userId,
        userEmail: r.user?.email ?? null,
        organizationId: r.organizationId,
        organizationName: r.organization?.name ?? null,
        subscriptionTier: r.subscriptionTier,
        industrySnapshot: r.industrySnapshot,
        sessionId: r.sessionId,
        durationMs: r.durationMs,
        createdAt: r.createdAt,
      })),
    };
  }
}

