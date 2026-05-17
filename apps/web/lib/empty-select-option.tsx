"use client";

import { useTranslation } from "react-i18next";

/** Value for "no selection" in native `<select>` elements. */
export const EMPTY_SELECT_VALUE = "";

/** Renders `<option value="">—</option>` for placeholder rows in selects. */
export function EmptySelectOption() {
  const { t } = useTranslation();
  return <option value={EMPTY_SELECT_VALUE}>{t("common.emptyValue")}</option>;
}
