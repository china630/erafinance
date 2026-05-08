import { SetMetadata } from "@nestjs/common";
import { REQUIRES_STEP_UP_KEY } from "./step-up.constants";

/** Requires header `X-StepUp-Token` (JWT from POST .../step-up/otp/verify). */
export const RequiresStepUp = (purpose: string) => SetMetadata(REQUIRES_STEP_UP_KEY, purpose);
