/** JSON `status` codes from Drakaris/yığım provider API spec (PDF sample). */
export const DrakarisStatus = {
  OK: 200,
  INVALID_CLIENT_ID: 401,
  PAYMENTS_DISABLED: 402,
  NOT_AVAILABLE_FOR_CLIENT: 404,
  INTERNAL_ERROR: 405,
  DUPLICATE_TRANSACTION: 406,
  CURRENCY_MISMATCH: 407,
  VALIDATION_ERROR: 408,
} as const;

export type DrakarisStatusCode =
  (typeof DrakarisStatus)[keyof typeof DrakarisStatus];

export const DRAKARIS_STATUS_DESCRIPTIONS: Record<number, string> = {
  [DrakarisStatus.OK]: "Operation completed successfully",
  [DrakarisStatus.INVALID_CLIENT_ID]: "Client id is invalid",
  [DrakarisStatus.PAYMENTS_DISABLED]: "Payments with YIĞIM are disabled",
  [DrakarisStatus.NOT_AVAILABLE_FOR_CLIENT]:
    "Payments with YIĞIM are not available for this client",
  [DrakarisStatus.INTERNAL_ERROR]:
    "There is an internal error. Try later or contact Provider's team",
  [DrakarisStatus.DUPLICATE_TRANSACTION]:
    "Transaction with given transaction-id already exists",
  [DrakarisStatus.CURRENCY_MISMATCH]:
    "Transaction should have the same currency as client balance",
  [DrakarisStatus.VALIDATION_ERROR]: "Request validation error",
};

export type DrakarisEnvelope<T = unknown> = {
  status: number;
  description: string;
  data: T | null;
};
