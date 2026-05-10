import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  CreatePaymentSessionParams,
  CreatePaymentSessionResult,
} from "../../../billing/payment.types";

/**
 * Drakaris/yığım: payment happens in the external aggregator app — no redirect URL to a bank page.
 * Returns a stable instructions URL on our Web app (subscription settings).
 */
@Injectable()
export class DrakarisPaymentProvider {
  constructor(private readonly config: ConfigService) {}

  async createPaymentSession(
    params: CreatePaymentSessionParams,
  ): Promise<CreatePaymentSessionResult> {
    const webApp = this.config
      .get<string>("WEB_APP_PUBLIC_URL", "http://localhost:3000")
      .replace(/\/$/, "");
    return {
      paymentUrl: `${webApp}/settings/subscription?drakarisOrderId=${encodeURIComponent(params.internalOrderId)}`,
      providerMode: "drakaris",
    };
  }
}
