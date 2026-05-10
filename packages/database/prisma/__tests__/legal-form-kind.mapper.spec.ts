import { CounterpartyLegalForm, OrganizationKind } from "@prisma/client";
import { legalFormToOrganizationKind } from "../lib/org/legal-form-kind.mapper";

describe("legalFormToOrganizationKind", () => {
  it("maps STATE_AGENCY to BUDGET", () => {
    expect(legalFormToOrganizationKind(CounterpartyLegalForm.STATE_AGENCY)).toBe(
      OrganizationKind.BUDGET,
    );
  });

  it("maps NGO to NGO", () => {
    expect(legalFormToOrganizationKind(CounterpartyLegalForm.NGO)).toBe(OrganizationKind.NGO);
  });

  it("maps other forms to COMMERCIAL", () => {
    const commercialForms = [
      CounterpartyLegalForm.INDIVIDUAL,
      CounterpartyLegalForm.LLC,
      CounterpartyLegalForm.CJSC,
      CounterpartyLegalForm.OJSC,
      CounterpartyLegalForm.PUBLIC_LEGAL_ENTITY,
      CounterpartyLegalForm.BRANCH,
      CounterpartyLegalForm.HOA,
    ];
    for (const f of commercialForms) {
      expect(legalFormToOrganizationKind(f)).toBe(OrganizationKind.COMMERCIAL);
    }
  });
});
