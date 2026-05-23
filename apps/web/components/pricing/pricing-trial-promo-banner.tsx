import Link from "next/link";

export function PricingTrialPromoBanner({
  text,
  buttonLabel,
  href = "/register-org",
  className = "mt-8",
}: {
  text: string;
  buttonLabel: string;
  href?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[#2980B9]/25 bg-gradient-to-br from-[#EBF5FB] to-white px-5 py-6 text-center md:px-8 ${className}`}
    >
      <p className="m-0 text-[15px] font-medium leading-relaxed text-slate-700 md:text-base">
        {text}
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#2980B9] px-6 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-[#2471A3]"
      >
        {buttonLabel}
      </Link>
    </div>
  );
}
