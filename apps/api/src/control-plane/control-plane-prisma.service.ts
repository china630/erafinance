import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@era365/database";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Control-plane Prisma client (billing, subscription, RBAC tables).
 * Shares DATABASE_URL with finance data plane during migration.
 */
@Injectable()
export class ControlPlanePrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is required");
    }
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool as unknown as never);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
