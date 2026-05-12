/**
 * Verify audit log hash chains (staging / prod drill).
 *
 *   npm run audit:verify -w @erafinance/api
 *
 * Optional: `AUDIT_VERIFY_ORG_ID=<uuid>` — single organization only.
 * Optional: `AUDIT_VERIFY_STRICT=1` — exit 1 if any chain is compromised (use on staging/prod copies).
 *
 * Uses a minimal Nest context (Prisma + AuditService only) so it does not boot banking/auth adapters.
 */
import { Logger, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AuditService } from "../src/audit/audit.service";
import { apiEnvFilePaths } from "../src/load-env-paths";
import { DataMaskingService } from "../src/privacy/data-masking.service";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

const envFiles = apiEnvFilePaths();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFiles.length ? envFiles : [".env"],
    }),
    PrismaModule,
  ],
  providers: [
    DataMaskingService,
    {
      provide: AuditService,
      useFactory: (
        prisma: PrismaService,
        config: ConfigService,
        masking: DataMaskingService,
      ) => new AuditService(prisma, config, masking),
      inject: [PrismaService, ConfigService, DataMaskingService],
    },
  ],
})
class AuditVerifyModule {}

async function main() {
  const logger = new Logger("audit-verify");
  const app = await NestFactory.createApplicationContext(AuditVerifyModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const audit = app.get(AuditService);
    const orgId = process.env.AUDIT_VERIFY_ORG_ID?.trim();
    const strict = process.env.AUDIT_VERIFY_STRICT === "1";
    const verbose = process.env.AUDIT_VERIFY_VERBOSE === "1";
    const trimIds = (ids: string[]) =>
      verbose ? ids : ids.length <= 12 ? ids : [...ids.slice(0, 12), `…+${ids.length - 12} more`];
    if (orgId) {
      const r = await audit.verifyOrganizationChain(orgId);
      const out = {
        scope: "organization" as const,
        organizationId: orgId,
        total: r.total,
        compromisedCount: r.compromisedCount,
        compromisedIds: trimIds(r.compromisedIds),
      };
      logger.log(JSON.stringify(out));
      if (strict && r.compromisedCount > 0) process.exitCode = 1;
      return;
    }
    const r = await audit.verifyChain();
    logger.log(
      JSON.stringify({
        scope: "all_organizations" as const,
        organizationsScanned: r.organizationsScanned,
        compromisedOrganizations: r.compromisedOrganizations,
        compromisedIds: trimIds(r.compromisedIds),
      }),
    );
    if (strict && r.compromisedOrganizations > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
