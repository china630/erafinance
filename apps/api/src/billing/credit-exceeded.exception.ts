import { HttpException, HttpStatus } from "@nestjs/common";
import type { BillableActionType } from "./billing-rate-card";

export type CreditExceededCode = "CREDIT_HARD_LOCK" | "USAGE_CAP_EXCEEDED";

export class CreditExceededException extends HttpException {
  constructor(
    public readonly code: CreditExceededCode,
    public readonly actionType?: BillableActionType,
    message?: string,
  ) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code,
        actionType,
        message:
          message ??
          (code === "USAGE_CAP_EXCEEDED"
            ? "Monthly usage cap exceeded for current credit tier"
            : "Credit debt threshold exceeded — payment required"),
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
