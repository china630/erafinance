import { ConfigService } from "@nestjs/config";
import {
  DigitalSignatureStatus,
  SignatureProvider,
  SignedDocumentKind,
} from "@erafinance/database";
import { verifyQrPublicBase } from "../common/verify-public-url";
import { PrismaService } from "../prisma/prisma.service";
import { decryptText } from "../security/pii-crypto.util";
import type { InvoicePdfModel } from "./invoice-pdf.render";

export async function buildInvoicePdfModelFromIds(
  prisma: PrismaService,
  config: ConfigService,
  organizationId: string,
  invoiceId: string,
): Promise<InvoicePdfModel | null> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    include: {
      counterparty: true,
      items: { include: { product: true } },
    },
  });
  if (!invoice) return null;

  const sig = await prisma.digitalSignatureLog.findFirst({
    where: {
      organizationId,
      documentId: invoiceId,
      documentKind: SignedDocumentKind.INVOICE,
      status: DigitalSignatureStatus.COMPLETED,
    },
    orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
  });

  const base = verifyQrPublicBase(config);
  const signature =
    sig?.signedAt != null
      ? {
          verifyUrl: `${base}/verify/${sig.id}`,
          signedAt: sig.signedAt,
          providerLabel:
            sig.provider === SignatureProvider.ASAN_IMZA ? "ASAN İmza" : "SİMA",
          certificateSubject: sig.certificateSubject,
        }
      : undefined;

  return {
    number: invoice.number,
    status: invoice.status,
    dueDate: invoice.dueDate,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    isInternational: (invoice as { isInternational?: boolean }).isInternational ?? false,
    counterparty: {
      name: invoice.counterparty.nameCipher
        ? decryptText(invoice.counterparty.nameCipher) ?? ""
        : "",
      taxId: invoice.counterparty.taxIdCipher
        ? decryptText(invoice.counterparty.taxIdCipher) ?? ""
        : "",
      country: invoice.counterparty.country ?? null,
    },
    items: invoice.items,
    signature,
  };
}

/** Guest PDF: same layout as internal invoice PDF, resolved by invoice id only (token already verified). */
export async function buildInvoicePdfModelByInvoiceIdPublic(
  prisma: PrismaService,
  config: ConfigService,
  invoiceId: string,
): Promise<InvoicePdfModel | null> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId },
    include: {
      counterparty: true,
      items: { include: { product: true } },
    },
  });
  if (!invoice) return null;

  const sig = await prisma.digitalSignatureLog.findFirst({
    where: {
      organizationId: invoice.organizationId,
      documentId: invoiceId,
      documentKind: SignedDocumentKind.INVOICE,
      status: DigitalSignatureStatus.COMPLETED,
    },
    orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
  });

  const base = verifyQrPublicBase(config);
  const signature =
    sig?.signedAt != null
      ? {
          verifyUrl: `${base}/verify/${sig.id}`,
          signedAt: sig.signedAt,
          providerLabel:
            sig.provider === SignatureProvider.ASAN_IMZA ? "ASAN İmza" : "SİMA",
          certificateSubject: sig.certificateSubject,
        }
      : undefined;

  return {
    number: invoice.number,
    status: invoice.status,
    dueDate: invoice.dueDate,
    totalAmount: invoice.totalAmount,
    currency: invoice.currency,
    isInternational: (invoice as { isInternational?: boolean }).isInternational ?? false,
    counterparty: {
      name: invoice.counterparty.nameCipher
        ? decryptText(invoice.counterparty.nameCipher) ?? ""
        : "",
      taxId: invoice.counterparty.taxIdCipher
        ? decryptText(invoice.counterparty.taxIdCipher) ?? ""
        : "",
      country: invoice.counterparty.country ?? null,
    },
    items: invoice.items,
    signature,
  };
}
