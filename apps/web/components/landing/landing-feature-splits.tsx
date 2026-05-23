import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type {
  LandingFeatureCopy,
  LandingMarketingCopy,
} from "../../lib/i18n/landing-marketing-copy";
import {
  BankStatementMock,
  ManufacturingOrderMock,
  TaxLimitWidgetMock,
} from "./landing-mock-previews";

function FeatureSplitSection({
  feature,
  visual,
  reverse = false,
}: {
  feature: LandingFeatureCopy;
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="px-4 py-10 md:py-14">
      <div
        className={`mx-auto flex max-w-6xl flex-col items-center gap-10 lg:gap-14 ${
          reverse ? "lg:flex-row-reverse" : "lg:flex-row"
        }`}
      >
        <div className="flex-1 space-y-4">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-wider text-[#2980B9]">
            {feature.eyebrow}
          </p>
          <h2 className="m-0 text-2xl font-bold leading-tight text-[#34495E] md:text-3xl">
            {feature.title}
          </h2>
          <p className="m-0 text-[14px] leading-relaxed text-[#7F8C8D]">{feature.body}</p>
          <ul className="m-0 space-y-2 p-0 list-none">
            {feature.bullets.map((item) => (
              <li key={item} className="flex gap-2 text-[13px] text-[#34495E]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2980B9]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full flex-1 lg:max-w-md">{visual}</div>
      </div>
    </section>
  );
}

export function LandingFeatureSplits({ copy }: { copy: LandingMarketingCopy }) {
  return (
  <>
      <FeatureSplitSection
        feature={copy.features.finance}
        visual={<BankStatementMock copy={copy.mocks.finance} />}
      />
      <FeatureSplitSection
        feature={copy.features.manufacturing}
        visual={<ManufacturingOrderMock copy={copy.mocks.manufacturing} />}
        reverse
      />
      <FeatureSplitSection
        feature={copy.features.tax}
        visual={<TaxLimitWidgetMock copy={copy.mocks.tax} />}
      />
    </>
  );
}
