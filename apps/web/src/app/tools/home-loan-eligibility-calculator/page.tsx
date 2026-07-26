import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { FaqGroup, type Faq } from "@/components/home/FaqGroup";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";
import { HomeLoanEligibilityForm } from "@/components/tools/HomeLoanEligibilityForm";

export const metadata = {
  title: "Home Loan Eligibility Calculator — Bhavano",
  description: "Estimate how large a home loan you could qualify for, based on your monthly income and existing EMIs.",
};

const FAQS: Faq[] = [
  {
    q: "What is FOIR?",
    a: "FOIR (Fixed Obligation to Income Ratio) is the share of your monthly income that lenders will let go toward fixed obligations — EMIs, most commonly. Lenders typically cap it at 40–50% of income.",
  },
  {
    q: "Why does this only give an estimate?",
    a: "Actual loan eligibility also depends on your credit score, employment type, age, other lender-specific policies, and the property itself — this calculator only models the income-based EMI cap.",
  },
  {
    q: "What if I have other loans (car, personal, existing home loan)?",
    a: "Enter their combined monthly EMI in 'Existing monthly EMIs' — lenders count all your obligations together against the same FOIR cap, not just the new loan.",
  },
  {
    q: "Should I borrow up to my maximum eligibility?",
    a: "Not necessarily — this is the maximum a lender might offer, not necessarily what's comfortable for your budget. Many buyers borrow less than their maximum eligibility.",
  },
];

export default function HomeLoanEligibilityCalculatorPage() {
  return (
    <StaticPageLayout title="Home Loan Eligibility Calculator">
      <PageSection heading="Estimate your home loan eligibility">
        <HomeLoanEligibilityForm />
      </PageSection>
      <PageSection heading="How this is calculated">
        <p className="m-0">
          Lenders generally cap your total monthly EMIs (existing obligations plus the new loan) at a percentage of
          your income — the <strong>FOIR</strong>. We take your income, apply that percentage, subtract any existing
          EMIs, and work out the largest loan amount whose own EMI fits in what&apos;s left, using the same reducing-
          balance formula as the EMI Calculator, solved for the loan amount instead of the EMI.
        </p>
        <p className="m-0">
          This is an estimate for planning purposes, not a loan offer or financial advice — actual eligibility varies
          by lender and depends on factors this calculator doesn&apos;t model, like credit score and employment type.
        </p>
      </PageSection>
      <FaqGroup title="Frequently asked questions" items={FAQS} />
      <JsonLd data={faqPageJsonLd(FAQS.map((f) => ({ q: f.q, a: f.a as string })))} />
    </StaticPageLayout>
  );
}
