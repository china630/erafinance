import { IsBoolean, IsOptional } from "class-validator";

/**
 * Переключатели модулей подписки (slugs в `activeModules` и legacy `production` / `ifrs`).
 * v10.5: полный каталог из PricingModule + обратная совместимость.
 */
export class UpdateSubscriptionModulesDto {
  @IsOptional()
  @IsBoolean()
  production?: boolean;

  @IsOptional()
  @IsBoolean()
  ifrs?: boolean;

  @IsOptional()
  @IsBoolean()
  cash_bank_pro?: boolean;

  /** @deprecated Use `cash_bank_pro`. */
  @IsOptional()
  @IsBoolean()
  kassa_pro?: boolean;

  /** @deprecated Use `cash_bank_pro`. */
  @IsOptional()
  @IsBoolean()
  banking_pro?: boolean;

  @IsOptional()
  @IsBoolean()
  inventory?: boolean;

  @IsOptional()
  @IsBoolean()
  manufacturing?: boolean;

  @IsOptional()
  @IsBoolean()
  hr_full?: boolean;

  @IsOptional()
  @IsBoolean()
  tax_pro?: boolean;

  @IsOptional()
  @IsBoolean()
  trade_pro?: boolean;

  @IsOptional()
  @IsBoolean()
  recovery_pro?: boolean;

  @IsOptional()
  @IsBoolean()
  ifrs_mapping?: boolean;

  @IsOptional()
  @IsBoolean()
  audit_hub?: boolean;

  @IsOptional()
  @IsBoolean()
  compliance_pro?: boolean;
}
