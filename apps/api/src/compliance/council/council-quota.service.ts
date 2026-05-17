import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CouncilQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  monthlyLimit(): number {
    const raw = this.config.get<string>("COUNCIL_MONTHLY_MANUAL_QUOTA");
    const n = raw ? Number(raw) : 5;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
  }

  async assertManualQuota(organizationId: string): Promise<void> {
    const limit = this.monthlyLimit();
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const used = await this.prisma.councilVerdict.count({
      where: {
        organizationId,
        triggerSource: "MANUAL",
        createdAt: { gte: start },
      },
    });
    if (used >= limit) {
      throw new BadRequestException(
        `Council manual deliberation quota exceeded (${limit}/month).`,
      );
    }
  }

}
