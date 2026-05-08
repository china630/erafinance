import { Prisma, PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.pricingModule.upsert({
      where: { key: "trade_pro" },
      update: {
        name: "Trade Pro",
        pricePerMonth: new Prisma.Decimal(14),
        sortOrder: 3,
      },
      create: {
        key: "trade_pro",
        name: "Trade Pro",
        pricePerMonth: new Prisma.Decimal(14),
        sortOrder: 3,
      },
    });
    console.log("trade_pro pricing module ensured");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
