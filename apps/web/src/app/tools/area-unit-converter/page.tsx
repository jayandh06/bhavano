import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { FaqGroup, type Faq } from "@/components/home/FaqGroup";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";
import { AreaUnitConverterForm } from "@/components/tools/AreaUnitConverterForm";

export const metadata = {
  title: "Area Unit Converter — Bhavano",
  description: "Convert property area between square feet, square metres, acres, hectares, and cents.",
};

const FAQS: Faq[] = [
  {
    q: "How many square feet are in an acre?",
    a: "1 acre = 43,560 square feet = 4,046.86 square metres = 0.404686 hectares.",
  },
  {
    q: "How many square feet are in a cent?",
    a: "1 cent = 435.6 square feet = 40.47 square metres. A cent is 1/100th of an acre.",
  },
  {
    q: "Why doesn't this converter include guntha, bigha, marla, or kanal?",
    a: "Those units' conversion factor varies by state and even by local custom, so a single fixed number would risk being wrong for your area. We've kept this converter to units with one nationally-standardized value.",
  },
];

export default function AreaUnitConverterPage() {
  return (
    <StaticPageLayout title="Area Unit Converter">
      <PageSection heading="Convert between area units">
        <AreaUnitConverterForm />
      </PageSection>
      <PageSection heading="Standard conversion factors">
        <ul className="m-0 pl-5">
          <li>1 acre = 43,560 sq ft = 4,046.86 sq m = 0.404686 hectares = 100 cents</li>
          <li>1 cent = 435.6 sq ft = 40.47 sq m</li>
          <li>1 hectare = 10,000 sq m = 2.471 acres</li>
          <li>1 sq m = 10.764 sq ft</li>
        </ul>
        <p className="m-0">
          These five units (square feet, square metres, acres, hectares, and cents) have one fixed, nationally-
          standardized conversion factor each. Regionally-varying units like guntha, bigha, marla, and kanal are
          deliberately not included here, since their exact size differs by state.
        </p>
      </PageSection>
      <FaqGroup title="Frequently asked questions" items={FAQS} />
      <JsonLd data={faqPageJsonLd(FAQS.map((f) => ({ q: f.q, a: f.a as string })))} />
    </StaticPageLayout>
  );
}
