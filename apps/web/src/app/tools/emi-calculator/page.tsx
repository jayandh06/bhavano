import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { FaqGroup, type Faq } from "@/components/home/FaqGroup";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";
import { EmiCalculatorForm } from "@/components/tools/EmiCalculatorForm";

export const metadata = {
  title: "EMI Calculator — Bhavano",
  description: "Free EMI calculator to estimate your monthly home loan installment from loan amount, interest rate, and tenure.",
};

const FAQS: Faq[] = [
  {
    q: "What is EMI?",
    a: "EMI (Equated Monthly Installment) is the fixed amount you pay your lender every month until a loan is fully repaid — it includes both principal and interest.",
  },
  {
    q: "How is EMI calculated?",
    a: "EMI is calculated using the reducing-balance formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1), where P is the loan amount, r is the monthly interest rate, and n is the number of monthly installments.",
  },
  {
    q: "Does a lower interest rate always mean a lower EMI?",
    a: "Yes, all else equal — a lower rate reduces both your EMI and the total interest paid over the loan's life.",
  },
  {
    q: "Is this figure exact?",
    a: "This is an estimate for planning purposes. Your lender's actual EMI may differ slightly due to processing fees, exact disbursement dates, or a floating rate that changes over the loan term.",
  },
];

export default function EmiCalculatorPage() {
  return (
    <StaticPageLayout title="EMI Calculator">
      <PageSection heading="Calculate your monthly EMI">
        <EmiCalculatorForm />
      </PageSection>
      <PageSection heading="How EMI is calculated">
        <p className="m-0">
          EMI uses the standard reducing-balance formula: <strong>EMI = P × r × (1+r)ⁿ / ((1+r)ⁿ − 1)</strong>, where{" "}
          <strong>P</strong> is your loan amount, <strong>r</strong> is the interest rate per month (annual rate ÷
          12), and <strong>n</strong> is the number of monthly installments (tenure in years × 12). Each installment
          is a mix of interest and principal — early payments are interest-heavy, later ones are principal-heavy,
          though the total EMI stays the same throughout.
        </p>
        <p className="m-0">This is an estimate for planning purposes, not financial advice.</p>
      </PageSection>
      <FaqGroup title="Frequently asked questions" items={FAQS} />
      <JsonLd data={faqPageJsonLd(FAQS.map((f) => ({ q: f.q, a: f.a as string })))} />
    </StaticPageLayout>
  );
}
