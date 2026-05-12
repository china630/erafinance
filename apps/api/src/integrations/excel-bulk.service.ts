import { Injectable, BadRequestException } from "@nestjs/common";
import { CustomsDeclarationStatus, Prisma } from "@erafinance/database";
import ExcelJS from "exceljs";
import {
  CustomsDeclarationPrefillSchema,
  type CustomsDeclarationPrefill,
} from "@erafinance/api-contracts";
import { PrismaService } from "../prisma/prisma.service";
import { decryptText } from "../security/pii-crypto.util";
import { IntegrationSyncRunService } from "./integration-sync-run.service";

@Injectable()
export class ExcelBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncRuns: IntegrationSyncRunService,
  ) {}

  async exportInvoices(organizationId: string, invoiceIds: string[]): Promise<Buffer> {
    const rows = await this.prisma.invoice.findMany({
      where: { organizationId, id: { in: invoiceIds } },
      include: { counterparty: { select: { nameCipher: true, taxIdCipher: true } } },
      orderBy: { createdAt: "asc" },
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("DVX Export");
    ws.addRow(["invoiceId", "number", "counterparty", "taxId", "currency", "totalAmount"]);
    for (const row of rows) {
      ws.addRow([
        row.id,
        row.number,
        row.counterparty.nameCipher ? decryptText(row.counterparty.nameCipher) ?? "" : "",
        row.counterparty.taxIdCipher ? decryptText(row.counterparty.taxIdCipher) ?? "" : "",
        row.currency,
        row.totalAmount.toString(),
      ]);
    }
    const runId = await this.syncRuns.start({
      organizationId,
      portal: "DVX",
      flow: "eqaime",
      transport: "EXCEL_IMPORT",
      totalCount: rows.length,
    });
    ws.addRow([]);
    ws.addRow(["runId", runId]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async exportEmployees(organizationId: string, employeeIds: string[]): Promise<Buffer> {
    const rows = await this.prisma.employee.findMany({
      where: { organizationId, id: { in: employeeIds } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("EMAS Export");
    ws.addRow(["employeeId", "firstName", "lastName", "finCode", "salary"]);
    for (const row of rows) {
      ws.addRow([row.id, row.firstName, row.lastName, row.finCode, row.salary.toString()]);
    }
    const runId = await this.syncRuns.start({
      organizationId,
      portal: "EMAS",
      flow: "emuqavile",
      transport: "EXCEL_IMPORT",
      totalCount: rows.length,
    });
    ws.addRow([]);
    ws.addRow(["runId", runId]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async importInvoiceResults(organizationId: string, file: Buffer): Promise<{ ok: true }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file as unknown as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException("Workbook is empty");
    const header = ws.getRow(1);
    if (String(header.getCell(1).value) !== "invoiceId") {
      throw new BadRequestException("Invalid invoice result sheet format");
    }
    for (let i = 2; i <= ws.rowCount; i += 1) {
      const row = ws.getRow(i);
      const invoiceId = String(row.getCell(1).value ?? "").trim();
      if (!invoiceId) continue;
      const status = String(row.getCell(2).value ?? "ERROR").trim();
      const error = String(row.getCell(3).value ?? "").trim();
      await this.prisma.invoice.updateMany({
        where: { organizationId, id: invoiceId },
        data: {
          dvxSyncStatus: status === "SYNCED" ? "SYNCED" : "ERROR",
          dvxSyncedAt: status === "SYNCED" ? new Date() : null,
          dvxSyncError: error || null,
        } as never,
      });
    }
    return { ok: true };
  }

  async importEmployeeResults(organizationId: string, file: Buffer): Promise<{ ok: true }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file as unknown as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException("Workbook is empty");
    const header = ws.getRow(1);
    if (String(header.getCell(1).value) !== "employeeId") {
      throw new BadRequestException("Invalid employee result sheet format");
    }
    for (let i = 2; i <= ws.rowCount; i += 1) {
      const row = ws.getRow(i);
      const employeeId = String(row.getCell(1).value ?? "").trim();
      if (!employeeId) continue;
      const status = String(row.getCell(2).value ?? "ERROR").trim();
      const error = String(row.getCell(3).value ?? "").trim();
      await this.prisma.employee.updateMany({
        where: { organizationId, id: employeeId },
        data: {
          emasSyncStatus: status === "SYNCED" ? "SYNCED" : "ERROR",
          emasSyncedAt: status === "SYNCED" ? new Date() : null,
          emasSyncError: error || null,
        } as never,
      });
    }
    return { ok: true };
  }

  async exportCustoms(organizationId: string, ids: string[]): Promise<Buffer> {
    const where =
      ids.length > 0
        ? { organizationId, id: { in: ids } }
        : { organizationId };
    const rows = await this.prisma.customsDeclaration.findMany({
      where,
      orderBy: [{ bgdDate: "desc" }, { createdAt: "desc" }],
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BGD Export");
    ws.addRow([
      "bgdNumber",
      "bgdDate",
      "currency",
      "customsValueAzn",
      "customsDutyAzn",
      "customsVatAzn",
      "feesAzn",
      "notes",
    ]);
    for (const row of rows) {
      ws.addRow([
        row.bgdNumber,
        row.bgdDate.toISOString().slice(0, 10),
        row.currency,
        row.customsValueAzn.toString(),
        row.customsDutyAzn.toString(),
        row.customsVatAzn.toString(),
        row.feesAzn.toString(),
        row.notes ?? "",
      ]);
    }
    const runId = await this.syncRuns.start({
      organizationId,
      portal: "CUSTOMS",
      flow: "bgd-export",
      transport: "EXCEL_IMPORT",
      totalCount: rows.length,
    });
    await this.syncRuns.complete({
      runId,
      successCount: rows.length,
      errorCount: 0,
      notes: { exportedIds: rows.map((r) => r.id) },
    });
    ws.addRow([]);
    ws.addRow(["Read me", "Import edited rows via POST /api/integrations/customs/declarations/import-excel"]);
    ws.addRow(["runId", runId]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async importCustoms(
    organizationId: string,
    file: Buffer,
    userId: string,
  ): Promise<{ inserted: number; skipped: number; errors: string[] }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file as unknown as any);
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException("Workbook is empty");
    const h1 = String(ws.getRow(1).getCell(1).value ?? "").trim();
    if (h1 !== "bgdNumber") {
      throw new BadRequestException("Invalid BGD sheet: expected bgdNumber in column A");
    }

    const parsedRows: CustomsDeclarationPrefill[] = [];
    const errors: string[] = [];
    const seenInFile = new Set<string>();
    for (let i = 2; i <= ws.rowCount; i += 1) {
      const row = ws.getRow(i);
      const bgdNumber = String(row.getCell(1).value ?? "").trim();
      if (!bgdNumber) continue;
      if (seenInFile.has(bgdNumber)) {
        errors.push(`Row ${i}: duplicate bgdNumber in file (${bgdNumber})`);
        continue;
      }
      seenInFile.add(bgdNumber);
      const raw = {
        bgdNumber,
        bgdDate: String(row.getCell(2).value ?? "").trim(),
        currency: String(row.getCell(3).value ?? "").trim() || "AZN",
        customsValueAzn: Number(row.getCell(4).value ?? 0),
        customsDutyAzn: Number(row.getCell(5).value ?? 0),
        customsVatAzn: Number(row.getCell(6).value ?? 0),
        feesAzn: Number(row.getCell(7).value ?? 0),
        notes: row.getCell(8).value == null ? null : String(row.getCell(8).value),
      };
      const z = CustomsDeclarationPrefillSchema.safeParse(raw);
      if (!z.success) {
        errors.push(`Row ${i}: ${z.error.flatten().formErrors.join("; ")}`);
        continue;
      }
      parsedRows.push(z.data);
    }

    const runId = await this.syncRuns.start({
      organizationId,
      portal: "CUSTOMS",
      flow: "bgd-import",
      transport: "EXCEL_IMPORT",
      totalCount: parsedRows.length,
      triggeredByUserId: userId,
    });

    let inserted = 0;
    let skipped = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const dto of parsedRows) {
          const exists = await tx.customsDeclaration.findUnique({
            where: {
              organizationId_bgdNumber: {
                organizationId,
                bgdNumber: dto.bgdNumber.trim(),
              },
            },
            select: { id: true },
          });
          if (exists) {
            skipped += 1;
            continue;
          }
          const notes = dto.notes?.trim()
            ? `${dto.notes.trim()}\n[capture] ${JSON.stringify({ source: "EXCEL", capturedAt: new Date().toISOString() })}`
            : `[capture] ${JSON.stringify({ source: "EXCEL", capturedAt: new Date().toISOString() })}`;
          await tx.customsDeclaration.create({
            data: {
              organizationId,
              bgdNumber: dto.bgdNumber.trim(),
              bgdDate: new Date(`${dto.bgdDate.slice(0, 10)}T00:00:00.000Z`),
              currency: dto.currency.trim(),
              customsValueAzn: new Prisma.Decimal(dto.customsValueAzn),
              customsDutyAzn: new Prisma.Decimal(dto.customsDutyAzn),
              customsVatAzn: new Prisma.Decimal(dto.customsVatAzn),
              feesAzn: new Prisma.Decimal(dto.feesAzn),
              notes,
              status: CustomsDeclarationStatus.DRAFT,
            },
          });
          inserted += 1;
        }
      });
      await this.syncRuns.complete({
        runId,
        successCount: inserted,
        errorCount: errors.length,
        notes: { skipped, parseErrors: errors },
      });
    } catch (e) {
      await this.syncRuns.complete({
        runId,
        successCount: inserted,
        errorCount: 1,
        notes: { error: e instanceof Error ? e.message : String(e) },
      });
      throw e;
    }

    return { inserted, skipped, errors };
  }
}
