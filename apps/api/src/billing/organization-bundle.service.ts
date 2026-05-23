import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { catalogModuleKeyToPatch } from "./billing-module-toggle.helpers";
import { endOfUtcMonth } from "./organization-module.service";

@Injectable()
export class OrganizationBundleService {
  private readonly logger = new Logger(OrganizationBundleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async upsertActiveInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    bundleId: string,
    priceSnapshot: Prisma.Decimal,
  ): Promise<void> {
    await tx.organizationBundle.upsert({
      where: {
        organizationId_bundleId: { organizationId, bundleId },
      },
      create: {
        organizationId,
        bundleId,
        priceSnapshot,
        pendingDeactivation: false,
        cancelledAt: null,
        accessUntil: null,
      },
      update: {
        priceSnapshot,
        pendingDeactivation: false,
        cancelledAt: null,
        accessUntil: null,
        activatedAt: new Date(),
      },
    });
  }

  async scheduleCancellationInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    bundleId: string,
    priceSnapshot: Prisma.Decimal,
  ): Promise<void> {
    const accessUntil = endOfUtcMonth(new Date());
    await tx.organizationBundle.upsert({
      where: {
        organizationId_bundleId: { organizationId, bundleId },
      },
      create: {
        organizationId,
        bundleId,
        priceSnapshot,
        pendingDeactivation: true,
        cancelledAt: new Date(),
        accessUntil,
      },
      update: {
        pendingDeactivation: true,
        cancelledAt: new Date(),
        accessUntil,
      },
    });
  }

  async enableBundleModulesInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    moduleKeys: string[],
  ): Promise<void> {
    for (const key of moduleKeys) {
      await this.subscriptionAccess.updateModuleAddons(
        organizationId,
        catalogModuleKeyToPatch(key, true),
        tx,
      );
    }
  }

  async disableBundleModulesInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    moduleKeys: string[],
  ): Promise<void> {
    for (const key of moduleKeys) {
      await this.subscriptionAccess.updateModuleAddons(
        organizationId,
        catalogModuleKeyToPatch(key, false),
        tx,
      );
    }
  }

  async finalizeExpiredBundleCancellations(now = new Date()): Promise<number> {
    const expired = await this.prisma.organizationBundle.findMany({
      where: {
        cancelledAt: { not: null },
        accessUntil: { lt: now },
      },
      include: { bundle: true },
    });
    let n = 0;
    for (const row of expired) {
      const keys = Array.isArray(row.bundle.moduleKeys)
        ? (row.bundle.moduleKeys as string[]).map(String)
        : [];
      const stillActive = await this.prisma.organizationBundle.findMany({
        where: {
          organizationId: row.organizationId,
          bundleId: { not: row.bundleId },
          OR: [{ cancelledAt: null }, { accessUntil: { gte: now } }],
        },
        include: { bundle: true },
      });
      const coveredElsewhere = new Set<string>();
      for (const other of stillActive) {
        const otherKeys = Array.isArray(other.bundle.moduleKeys)
          ? (other.bundle.moduleKeys as string[]).map(String)
          : [];
        for (const k of otherKeys) coveredElsewhere.add(k);
      }
      const toDisable = keys.filter((k) => !coveredElsewhere.has(k));
      await this.prisma.$transaction(async (tx) => {
        if (toDisable.length > 0) {
          await this.disableBundleModulesInTx(
            tx,
            row.organizationId,
            toDisable,
          );
        }
        await tx.organizationBundle.delete({
          where: {
            organizationId_bundleId: {
              organizationId: row.organizationId,
              bundleId: row.bundleId,
            },
          },
        });
      });
      n++;
    }
    if (n > 0) {
      this.logger.log(`Finalized ${n} expired organization bundle cancellation(s)`);
    }
    return n;
  }
}
