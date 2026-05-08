import { Injectable, Logger } from "@nestjs/common";
import PDFDocument from "pdfkit";

@Injectable()
export class TransferCertificateService {
  private readonly logger = new Logger(TransferCertificateService.name);

  /** Generates a minimal PDF certificate (HMAC signing / QR — R2.5 extension). */
  async buildTransferCertificatePdf(params: {
    organizationName: string;
    disputeId: string;
    claimantId: string;
    incumbentId: string;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    doc.fontSize(18).text("Ownership transfer certificate", { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(`Organization: ${params.organizationName}`);
    doc.text(`Dispute ID: ${params.disputeId}`);
    doc.text(`Claimant user: ${params.claimantId}`);
    doc.text(`Incumbent user: ${params.incumbentId}`);
    doc.text(`Generated at (UTC): ${new Date().toISOString()}`);
    doc.end();
    const buf = await done;
    this.logger.log(`Transfer certificate PDF generated (${buf.length} bytes)`);
    return buf;
  }
}
