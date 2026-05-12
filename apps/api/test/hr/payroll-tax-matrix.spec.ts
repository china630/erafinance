import { Prisma } from "@erafinance/database";
import {
  calculateContractorMicroPayrollTax,
  calculatePayrollByTemplateGroup,
  CONTRACTOR_WITHHOLDING_RATE,
} from "../../src/payroll/tax-calculator";

describe("Payroll tax matrix by templateGroup", () => {
  const D = Prisma.Decimal;

  it("COMMERCIAL: zero income tax up to 8000", () => {
    const r = calculatePayrollByTemplateGroup(new D(8000), "COMMERCIAL", {
      dsmfEmployerPreferential: false,
    });
    expect(r.incomeTax.toFixed(2)).toBe("0.00");
    expect(r.net.greaterThan(0)).toBe(true);
  });

  it("COMMERCIAL: high salary remains positive net", () => {
    const r = calculatePayrollByTemplateGroup(new D(200000), "COMMERCIAL", {
      dsmfEmployerPreferential: true,
    });
    expect(r.net.greaterThan(0)).toBe(true);
    expect(r.incomeTax.greaterThan(0)).toBe(true);
  });

  it("GOVERNMENT: applies standard profile", () => {
    const r = calculatePayrollByTemplateGroup(new D(3000), "GOVERNMENT");
    expect(r.incomeTax.toFixed(2)).toBe("420.00");
    expect(r.dsmfWorker.toFixed(2)).toBe("90.00");
    expect(r.itsWorker.toFixed(2)).toBe("60.00");
  });

  it("rounding edge cases keep 2 decimals", () => {
    const r = calculatePayrollByTemplateGroup(new D("1234.5678"), "COMMERCIAL", {
      dsmfEmployerPreferential: false,
    });
    expect(r.net.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
    expect(r.unemploymentWorker.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
  });

  it("edge case detects potential negative net externally", () => {
    const r = calculatePayrollByTemplateGroup(new D("1.00"), "COMMERCIAL", {
      dsmfEmployerPreferential: false,
    });
    expect(r.net.greaterThanOrEqualTo(0)).toBe(true);
  });

  it("CONTRACTOR: 5% withholding at source, no DSMF/İTS/unemployment", () => {
    const gross = new D("1000.00");
    const r = calculateContractorMicroPayrollTax(gross, null);
    expect(r.gross.toFixed(2)).toBe("1000.00");
    expect(r.incomeTax.toFixed(2)).toBe("50.00");
    expect(r.net.toFixed(2)).toBe("950.00");
    expect(r.dsmfWorker.isZero()).toBe(true);
    expect(r.dsmfEmployer.isZero()).toBe(true);
    expect(r.itsWorker.isZero()).toBe(true);
    expect(r.itsEmployer.isZero()).toBe(true);
    expect(r.unemploymentWorker.isZero()).toBe(true);
    expect(r.unemploymentEmployer.isZero()).toBe(true);
    expect(r.contractorSocialWithheld.isZero()).toBe(true);
    expect(CONTRACTOR_WITHHOLDING_RATE.toString()).toBe("0.05");
  });

  it("CONTRACTOR: net = gross - 5% - fixed social", () => {
    const r = calculateContractorMicroPayrollTax(new D("2000"), new D("100"));
    expect(r.incomeTax.toFixed(2)).toBe("100.00");
    expect(r.contractorSocialWithheld.toFixed(2)).toBe("100.00");
    expect(r.net.toFixed(2)).toBe("1800.00");
  });
});

