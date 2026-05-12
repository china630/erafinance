import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@erafinance/database";
import { ManufacturingService } from "./manufacturing.service";

describe("ManufacturingService.computeAvailableOutput", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";
  const whId = "00000000-0000-4000-8000-000000000002";
  const recipeId = "00000000-0000-4000-8000-000000000003";
  const compA = "00000000-0000-4000-8000-000000000010";
  const compB = "00000000-0000-4000-8000-000000000011";
  const fgId = "00000000-0000-4000-8000-000000000099";

  function makeService(prisma: {
    warehouse: { findFirst: jest.Mock };
    productRecipe: { findFirst: jest.Mock };
    stockItem: { findUnique: jest.Mock };
  }) {
    return new ManufacturingService(
      prisma as any,
      {} as any,
      {} as any,
    );
  }

  it("returns min across two components (one bottleneck)", async () => {
    const prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: whId }),
      },
      productRecipe: {
        findFirst: jest.fn().mockResolvedValue({
          id: recipeId,
          finishedProductId: fgId,
          finishedProduct: { name: "FG" },
          lines: [
            {
              componentProductId: compA,
              quantityPerUnit: new Decimal(2),
              wasteFactor: new Decimal(0),
              component: { name: "A" },
            },
            {
              componentProductId: compB,
              quantityPerUnit: new Decimal(1),
              wasteFactor: new Decimal(0),
              component: { name: "B" },
            },
          ],
        }),
      },
      stockItem: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.organizationId_warehouseId_productId.productId === compA) {
            return { quantity: new Decimal(100) };
          }
          if (where.organizationId_warehouseId_productId.productId === compB) {
            return { quantity: new Decimal(3) };
          }
          return null;
        }),
      },
    };
    const svc = makeService(prisma);
    const out = await svc.computeAvailableOutput(orgId, recipeId, undefined);
    expect(out.maxOutputUnits).toBe("3");
    expect(out.bottlenecks[0].maxFgFromLine).toBe("3");
    expect(out.bottlenecks[1].maxFgFromLine).toBe("50");
  });

  it("returns zero when a component has no stock", async () => {
    const prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: whId }),
      },
      productRecipe: {
        findFirst: jest.fn().mockResolvedValue({
          id: recipeId,
          finishedProductId: fgId,
          finishedProduct: { name: "FG" },
          lines: [
            {
              componentProductId: compA,
              quantityPerUnit: new Decimal(1),
              wasteFactor: new Decimal(0),
              component: { name: "A" },
            },
          ],
        }),
      },
      stockItem: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const svc = makeService(prisma);
    const out = await svc.computeAvailableOutput(orgId, recipeId, undefined);
    expect(out.maxOutputUnits).toBe("0");
  });

  it("applies wasteFactor to need per FG unit", async () => {
    const prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: whId }),
      },
      productRecipe: {
        findFirst: jest.fn().mockResolvedValue({
          id: recipeId,
          finishedProductId: fgId,
          finishedProduct: { name: "FG" },
          lines: [
            {
              componentProductId: compA,
              quantityPerUnit: new Decimal(1),
              wasteFactor: new Decimal(1),
              component: { name: "A" },
            },
          ],
        }),
      },
      stockItem: {
        findUnique: jest.fn().mockResolvedValue({ quantity: new Decimal(10) }),
      },
    };
    const svc = makeService(prisma);
    const out = await svc.computeAvailableOutput(orgId, recipeId, undefined);
    expect(out.maxOutputUnits).toBe("5");
  });

  it("throws NotFound when recipe missing", async () => {
    const prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: whId }),
      },
      productRecipe: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      stockItem: { findUnique: jest.fn() },
    };
    const svc = makeService(prisma);
    await expect(svc.computeAvailableOutput(orgId, recipeId, undefined)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequest when recipe has no lines", async () => {
    const prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: whId }),
      },
      productRecipe: {
        findFirst: jest.fn().mockResolvedValue({
          id: recipeId,
          finishedProductId: fgId,
          finishedProduct: { name: "FG" },
          lines: [],
        }),
      },
      stockItem: { findUnique: jest.fn() },
    };
    const svc = makeService(prisma);
    await expect(svc.computeAvailableOutput(orgId, recipeId, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });
});
