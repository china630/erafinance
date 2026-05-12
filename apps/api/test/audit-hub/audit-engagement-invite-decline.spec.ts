import { Test } from "@nestjs/testing";
import {
  AuditEngagementInviteStatus,
} from "@erafinance/database";
import { AuditEngagementInviteService } from "../../src/audit-hub/audit-engagement-invite.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";

describe("AuditEngagementInviteService decline", () => {
  const inviteId = "00000000-0000-0000-0000-0000000000a1";
  const token = "a".repeat(64);
  const tokenHash =
    "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb";

  it("declines pending invite when token matches", async () => {
    const prisma = {
      auditEngagementInvite: {
        findFirst: jest.fn().mockResolvedValue({
          id: inviteId,
          status: AuditEngagementInviteStatus.PENDING,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86_400_000),
          tokenHash,
          inviteeUserId: null,
          inviteeEmail: "guest@example.com",
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditEngagementInviteService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SubscriptionAccessService,
          useValue: { hasModule: jest.fn() },
        },
      ],
    }).compile();
    const svc = moduleRef.get(AuditEngagementInviteService);
    await expect(
      svc.declineInvite("u1", "guest@example.com", inviteId, token),
    ).resolves.toEqual({ ok: true });
    expect(prisma.auditEngagementInvite.update).toHaveBeenCalledWith({
      where: { id: inviteId },
      data: { status: AuditEngagementInviteStatus.DECLINED },
    });
  });
});
