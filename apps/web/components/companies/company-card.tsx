"use client";

import {
  Building2,
  Link2,
  MoreVertical,
  Settings,
  Unlink2,
} from "lucide-react";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@erafinance/ui";

type BadgeVariant = "neutral" | "owner" | "admin" | "accountant" | "user";

export type CompanyCardItem = {
  id: string;
  name: string;
  taxId: string;
  currency: string;
  role?: string;
  holdingId?: string | null;
  isCurrent?: boolean;
};

export function CompanyCard({
  company,
  roleLabel,
  roleVariant,
  settingsLabel,
  attachLabel,
  detachLabel,
  workspaceLabel,
  currentWorkspaceLabel,
  canManageHolding,
  canDetachFromHolding,
  onOpen,
  onOpenSettings,
  onAttachHolding,
  onDetachHolding,
}: {
  company: CompanyCardItem;
  roleLabel: (role: string) => string;
  roleVariant: (role: string) => BadgeVariant;
  settingsLabel: string;
  attachLabel: string;
  detachLabel: string;
  workspaceLabel: string;
  currentWorkspaceLabel: string;
  canManageHolding: boolean;
  canDetachFromHolding: boolean;
  onOpen: () => void;
  onOpenSettings: () => void;
  onAttachHolding: () => void;
  onDetachHolding: () => void;
}) {
  const initials = company.name
    .split(/\s+/)
    .map((x) => x[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex min-h-44 cursor-pointer flex-col rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition hover:border-[#2980B9]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2980B9]/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D5DADF] bg-[#EBEDF0] text-xs font-semibold text-[#34495E]">
            {initials || <Building2 className="h-4 w-4" aria-hidden />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
          </div>
        </div>
        {company.role ? (
          <Badge variant={roleVariant(company.role)}>{roleLabel(company.role)}</Badge>
        ) : null}
      </div>

      <div className="mt-3 text-sm text-muted-foreground">
        VÖEN {company.taxId} · {company.currency}
      </div>

      <div className="mt-auto flex items-end justify-between pt-4">
        <span className="text-xs text-muted-foreground">
          {company.isCurrent ? currentWorkspaceLabel : workspaceLabel}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition hover:bg-[#F4F5F7] hover:text-foreground"
            aria-label="Open company actions"
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onOpenSettings}>
                <Settings className="h-4 w-4" aria-hidden />
                {settingsLabel}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canManageHolding} onClick={onAttachHolding}>
                <Link2 className="h-4 w-4" aria-hidden />
                {attachLabel}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canDetachFromHolding}
              className="text-destructive hover:bg-red-50"
              onClick={onDetachHolding}
            >
                <Unlink2 className="h-4 w-4" aria-hidden />
                {detachLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}
