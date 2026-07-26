import type { ReactNode } from "react";
import { PageSection } from "./StaticPageLayout";

export interface Faq {
  q: string;
  a: ReactNode;
}

export function FaqGroup({ title, items }: { title: string; items: Faq[] }) {
  return (
    <PageSection heading={title}>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <details key={item.q} className="border border-border rounded-[10px] px-4 py-3 bg-surface">
            <summary className="font-bold text-sm text-text cursor-pointer">{item.q}</summary>
            <div className="mt-2.5 text-sm leading-[1.6] text-text-soft">{item.a}</div>
          </details>
        ))}
      </div>
    </PageSection>
  );
}
