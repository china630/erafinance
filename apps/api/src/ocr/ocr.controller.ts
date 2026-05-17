import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { VoenIntegrityGuard } from "../auth/guards/voen-integrity.guard";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { OcrService } from "./ocr.service";

@ApiTags("ocr")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard, VoenIntegrityGuard)
@RequiresModule(ModuleEntitlement.TRADE_PRO)
@Controller("ocr/invoices")
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @OrganizationId() organizationId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ocr.createJob(organizationId, file, user.userId);
  }

  @Get(":id")
  getOne(@OrganizationId() organizationId: string, @Param("id") id: string) {
    return this.ocr.getJob(organizationId, id);
  }
}
