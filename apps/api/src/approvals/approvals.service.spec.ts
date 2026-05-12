import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ApprovalDocumentType, UserRole } from "@erafinance/database";
import { Decimal } from "@erafinance/database";
import { ApprovalsService } from "./approvals.service";

describe("ApprovalsService", () => {
  const org = "00000000-0000-4000-8000-000000000001";
  const orderId = "00000000-0000-4000-8000-000000000002";
  const user = "00000000-0000-4000-8000-0000000000aa";

  it("rejectStep requires non-empty comment", async () => {
    const prisma = {} as any;
    const notifications = { createNotification: jest.fn() };
    const svc = new ApprovalsService(prisma, notifications as any);
    await expect(
      svc.rejectStep({
        organizationId: org,
        userId: user,
        requestId: orderId,
        stepNo: 1,
        comment: "   ",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("assertCashOrderMayPost blocks when policy matches but no approved request", async () => {
    const prisma = {
      cashOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          organizationId: org,
          amount: new Decimal("5000"),
          currency: "AZN",
        }),
      },
      approvalPolicy: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "pol1",
            organizationId: org,
            documentType: ApprovalDocumentType.CASH_ORDER,
            amountFrom: new Decimal("1000"),
            amountTo: new Decimal("10000"),
            currency: "AZN",
            approverRoles: [UserRole.OWNER],
            isActive: true,
          },
        ]),
      },
      approvalRequest: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null) // approved
          .mockResolvedValueOnce(null), // pending
      },
    };
    const notifications = { createNotification: jest.fn() };
    const svc = new ApprovalsService(prisma as any, notifications as any);
    await expect(svc.assertCashOrderMayPost(org, orderId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
