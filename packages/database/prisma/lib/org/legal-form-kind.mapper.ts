import { CounterpartyLegalForm, OrganizationKind } from "@prisma/client";

/**
 * Maps legal form selected at onboarding to NAS / organization kind.
 * STATE_AGENCY → budget NAS; NGO → NGO NAS; all other forms → commercial NAS.
 */
export function legalFormToOrganizationKind(
  legalForm: CounterpartyLegalForm,
): OrganizationKind {
  if (legalForm === CounterpartyLegalForm.STATE_AGENCY) {
    return OrganizationKind.BUDGET;
  }
  if (legalForm === CounterpartyLegalForm.NGO) {
    return OrganizationKind.NGO;
  }
  return OrganizationKind.COMMERCIAL;
}
