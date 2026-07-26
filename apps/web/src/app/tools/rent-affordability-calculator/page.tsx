import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { FaqGroup, type Faq } from "@/components/home/FaqGroup";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";
import { RentAffordabilityForm } from "@/components/tools/RentAffordabilityForm";

export const metadata = {
  title: "Rent Affordability Calculator — Bhavano",
  description: "Get a suggested maximum monthly rent based on your income, using the common 30-40% rule of thumb.",
};

const FAQS: Faq[] = [
  {
    q: "What's the 30-40% rule?",
    a: "A common budgeting guideline suggesting your rent shouldn't exceed 30-40% of your monthly income, leaving room for other expenses and savings.",
  },
  {
    q: "Should I use a lower or higher percentage?",
    a: "If you have significant other fixed costs (loan EMIs, dependents, high commute costs), lean toward the lower end (around 30%) or below. If your other obligations are light, up to 40% may be comfortable.",
  },
  {
    q: "Does this account for other expenses?",
    a: "No — this is a simple income-ratio estimate. It doesn't factor in your existing EMIs, savings goals, or other monthly costs, so treat the result as a starting point, not a strict limit.",
  },
];

export default function RentAffordabilityCalculatorPage() {
  return (
    <StaticPageLayout title="Rent Affordability Calculator">
      <PageSection heading="How much rent can you afford?">
        <RentAffordabilityForm />
      </PageSection>
      <PageSection heading="How this is calculated">
        <p className="m-0">
          This calculator applies a simple income-ratio rule of thumb: suggested maximum rent = monthly income ×
          rent percentage. It&apos;s a quick planning estimate, not a strict budget — it doesn&apos;t account for your existing
          loan payments, savings goals, or other monthly commitments.
        </p>
      </PageSection>
      <FaqGroup title="Frequently asked questions" items={FAQS} />
      <JsonLd data={faqPageJsonLd(FAQS.map((f) => ({ q: f.q, a: f.a as string })))} />
    </StaticPageLayout>
  );
}
