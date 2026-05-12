import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { SecurityMode } from "@erafinance/database";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "./audit.service";

@Injectable()
export class AuditChainCronService {
  private readonly logger = new Logger(AuditChainCronService.name);

  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Cron("0 2 * * *")
  async verifyAuditChainDaily(): Promise<void> {
    const res = await this.audit.verifyChain();
    if (res.compromisedOrganizations > 0) {
      const msg = `[CRITICAL] ERA Finance: Обнаружено нарушение целостности Audit Log. Возможна ручная манипуляция в БД. Скомпрометированные ID: ${res.compromisedIds.join(",")}`;
      this.logger.error(
        `Audit chain check failed: ${res.compromisedOrganizations} organization(s), compromisedIds=${res.compromisedIds.join(",")}`,
      );
      const orgs = await this.prisma.organization.findMany({ select: { id: true } });
      for (const org of orgs) {
        const chain = await this.audit.verifyOrganizationChain(org.id);
        if (chain.compromisedCount === 0) {
          continue;
        }
        try {
          await this.prisma.organizationSecurityState.upsert({
            where: { organizationId: org.id },
            create: {
              organizationId: org.id,
              mode: SecurityMode.HARD_BLOCK_PLATFORM,
            },
            update: { mode: SecurityMode.HARD_BLOCK_PLATFORM },
          });
        } catch (e) {
          this.logger.warn(
            `Could not set HARD_BLOCK_PLATFORM for ${org.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      await this.sendExternalCriticalAlert(msg, res.compromisedIds);
      const admins = await this.prisma.user.findMany({
        where: { isSuperAdmin: true },
        select: { email: true },
      });
      for (const a of admins) {
        if (!a.email) continue;
        await this.mail.sendMail({
          to: a.email,
          subject: "ERA Finance — CRITICAL: audit chain integrity failure",
          text: msg,
        });
      }
      return;
    }
    this.logger.log(
      `Audit chain check ok: scanned ${res.organizationsScanned} organization(s)`,
    );
  }

  private async sendExternalCriticalAlert(
    message: string,
    compromisedIds: string[],
  ): Promise<void> {
    const webhookUrl = this.config.get<string>("AUDIT_ALERT_WEBHOOK_URL", "").trim();
    if (!webhookUrl) {
      this.logger.warn(
        "AUDIT_ALERT_WEBHOOK_URL is not configured; critical audit alert sent to logs only",
      );
      return;
    }
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message,
          source: "audit-chain-cron",
          severity: "critical",
          compromisedIds,
          ts: new Date().toISOString(),
        }),
      });
    } catch (e) {
      this.logger.error(
        `Failed to send external audit alert: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
