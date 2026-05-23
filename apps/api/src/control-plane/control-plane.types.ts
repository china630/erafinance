export type ValidateEntitlementResponse = {
  allowed: boolean;
  billingStatus: "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK";
  code?: string;
  message?: string;
  httpStatus?: number;
};
