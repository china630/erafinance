import { Prisma, PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.pricingModule.upsert({
      where: { key: "tax_pro" },
      update: {
        name: "Tax Pro",
        pricePerMonth: new Prisma.Decimal(12),
        sortOrder: 2,
      },
      create: {
        key: "tax_pro",
        name: "Tax Pro",
        pricePerMonth: new Prisma.Decimal(12),
        sortOrder: 2,
      },
    });
    console.log("tax_pro pricing module ensured");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
