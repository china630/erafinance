import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole } from "@erafinance/database";
import { ActivityStreamService } from "./activity-stream.service";

describe("ActivityStreamService", () => {
  const org = "00000000-0000-4000-8000-000000000001";
  const inv = "00000000-0000-4000-8000-000000000002";
  const userA = "00000000-0000-4000-8000-0000000000a1";
  const userB = "00000000-0000-4000-8000-0000000000b1";

  it("getTimeline rejects unknown entity type", async () => {
    const prisma = { invoice: { findFirst: jest.fn() } };
    const notifications = { createNotification: jest.fn() };
    const svc = new ActivityStreamService(prisma as any, notifications as any);
    await expect(svc.getTimeline(org, "not-a-slug", inv)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("getTimeline returns 404 when entity missing", async () => {
    const prisma = {
      invoice: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const notifications = { createNotification: jest.fn() };
    const svc = new ActivityStreamService(prisma as any, notifications as any);
    await expect(svc.getTimeline(org, "invoice", inv)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("createComment stores mentions and notifies (by email)", async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: inv }),
      },
      organizationMembership: {
        findMany: jest.fn().mockResolvedValue([
          { userId: userB, user: { email: "colleague@example.com" } },
        ]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          entityComment: {
            create: jest.fn().mockResolvedValue({ id: "comment-1" }),
          },
          entityCommentMention: { create: jest.fn() },
        };
        return fn(tx);
      }),
    };
    const notifications = { createNotification: jest.fn() };
    const svc = new ActivityStreamService(prisma as any, notifications as any);

    await svc.createComment(org, userA, "invoice", inv, {
      body: "Hello @colleague@example.com",
    }, UserRole.OWNER);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: org,
        userId: userB,
        link: expect.stringContaining("/sales/invoices?invoice="),
      }),
    );
  });

  it("updateComment forbids non-author", async () => {
    const prisma = {
      entityComment: {
        findFirst: jest.fn().mockResolvedValue({
          id: "c1",
          organizationId: org,
          authorUserId: userA,
          deletedAt: null,
          kind: "NORMAL",
        }),
      },
    };
    const notifications = { createNotification: jest.fn() };
    const svc = new ActivityStreamService(prisma as any, notifications as any);
    await expect(
      svc.updateComment(org, "c1", userB, { body: "x" }, UserRole.OWNER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
