import type { ReactNode } from "react";

export function LandingPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#EBEDF0] bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#2980B9]/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-48 h-96 w-96 rounded-full bg-indigo-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-40 left-1/4 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-8 right-1/4 h-64 w-64 rounded-full bg-[#2980B9]/12 blur-3xl"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
