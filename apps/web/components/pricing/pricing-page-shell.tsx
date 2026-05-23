import type { ReactNode } from "react";

export function PricingPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#EBEDF0] font-sans text-slate-800 subpixel-antialiased">
      {children}
    </div>
  );
}

