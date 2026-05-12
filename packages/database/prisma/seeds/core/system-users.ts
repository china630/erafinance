import bcrypt from "bcrypt";
import type { SeedContext } from "../_engine/upsert";

const TECH_USERS = [
  "system+integrations@erafinance.local",
  "system+automation@erafinance.local",
] as const;

export async function seedSystemUsers(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  const hash = await bcrypt.hash("change-me-immediately", 10);
  for (const emailRaw of TECH_USERS) {
    const email = emailRaw.toLowerCase().trim();
    await ctx.prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hash,
        isSuperAdmin: false,
      },
      update: {
        passwordHash: hash,
      },
    });
  }
}
