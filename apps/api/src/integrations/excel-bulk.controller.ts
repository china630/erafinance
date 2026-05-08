import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUser } from "../auth/types/auth-user";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { ExcelBulkService } from "./excel-bulk.service";
import { TemplatesAssetsService } from "./templates-assets.service";

@ApiTags("integrations-bulk-excel")
@ApiBearerAuth("bearer")
@UseGuards(SubscriptionGuard)
@Controller("integrations")
export class ExcelBulkController {
  constructor(
    private readonly excelBulk: ExcelBulkService,
    private readonly templates: TemplatesAssetsService,
  ) {}

  @Get("dvx/invoices/export.xlsx")
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @ApiOperation({ summary: "Export selected invoices to DVX bulk xlsx" })
  async exportInvoices(
    @OrganizationId() organizationId: string,
    @Query("ids") ids: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const invoiceIds = ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const file = await this.excelBulk.exportInvoices(organizationId, invoiceIds);
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="dvx-invoices-export.xlsx"',
    );
    return new StreamableFile(file);
  }

  @Post("dvx/invoices/import-result")
  @RequiresModule(ModuleEntitlement.TAX_PRO)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Import DVX portal result xlsx for invoices" })
  importInvoiceResult(
    @OrganizationId() organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("file is required");
    return this.excelBulk.importInvoiceResults(organizationId, file.buffer);
  }

  @Get("emas/employees/export.xlsx")
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @ApiOperation({ summary: "Export selected employees to EMAS bulk xlsx" })
  async exportEmployees(
    @OrganizationId() organizationId: string,
    @Query("ids") ids: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const employeeIds = ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const file = await this.excelBulk.exportEmployees(organizationId, employeeIds);
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="emas-employees-export.xlsx"',
    );
    return new StreamableFile(file);
  }

  @Post("emas/employees/import-result")
  @RequiresModule(ModuleEntitlement.HR_FULL)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Import EMAS portal result xlsx for employees" })
  importEmployeeResult(
    @OrganizationId() organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("file is required");
    return this.excelBulk.importEmployeeResults(organizationId, file.buffer);
  }

  @Get("customs/declarations/export.xlsx")
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @ApiOperation({ summary: "Export selected BGD rows (or full org list when ids omitted)" })
  async exportCustoms(
    @OrganizationId() organizationId: string,
    @Query("ids") idsRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const ids = (idsRaw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const file = await this.excelBulk.exportCustoms(organizationId, ids);
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="customs-bgd-export.xlsx"',
    );
    return new StreamableFile(file);
  }

  @Get("customs/declarations/template.xlsx")
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @ApiOperation({ summary: "Download empty BGD import template" })
  getCustomsTemplate(@Res({ passthrough: true }) res: Response): StreamableFile {
    const file = this.templates.getTemplateStream("customs", "bgd-blank.xlsx");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="bgd-blank.xlsx"',
    );
    return file;
  }

  @Post("customs/declarations/import-excel")
  @RequiresModule(ModuleEntitlement.TRADE_PRO)
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Bulk import BGD declarations from Excel template" })
  importCustomsExcel(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException("file is required");
    return this.excelBulk.importCustoms(organizationId, file.buffer, user.userId);
  }
}
