"use client";

import {
  DEFAULT_CURRENCY,
  FALLBACK_CURRENCY_CODES,
  type SupportedCurrency,
} from "../../lib/currencies";
import { useAuth } from "../../lib/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";

type CurrencySelectProps = {
  value: string;
  onValueChange: (v: SupportedCurrency) => void;
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-label"?: string;
};

/** Currency dropdown from global catalog (`GET /api/system/currencies`), fallback when logged out. */
export function CurrencySelect({
  value,
  onValueChange,
  className = "",
  disabled,
  name,
  id,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: CurrencySelectProps) {
  const { currencyCodes } = useAuth();
  const codes =
    currencyCodes.length > 0 ? (currencyCodes as readonly string[]) : FALLBACK_CURRENCY_CODES;

  const v = codes.includes(value) ? value : DEFAULT_CURRENCY;

  return (
    <Select
      id={id}
      name={name}
      value={v}
      disabled={disabled}
      className={className}
      aria-invalid={ariaInvalid}
      aria-label={ariaLabel}
      onValueChange={(next) => onValueChange(next as SupportedCurrency)}
    >
      <SelectTrigger className="" />
      <SelectContent>
        {codes.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
