import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { FaqGroup, type Faq } from "@/components/home/FaqGroup";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";
import { DownPaymentForm } from "@/components/tools/DownPaymentForm";

export const metadata = {
  title: "Down Payment Calculator — Bhavano",
  description: "Work out the down payment you'll need on a property, from either a target loan-to-value % or a desired loan amount.",
};

const FAQS: Faq[] = [
  {
    q: "What is loan-to-value (LTV)?",
    a: "LTV is the loan amount as a percentage of the property's price. An 80% LTV on a ₹60 lakh property means an ₹48 lakh loan and a ₹12 lakh down payment.",
  },
  {
    q: "What LTV do lenders usually offer?",
    a: "Many lenders offer up to 75-90% LTV depending on the loan amount and property value, meaning a down payment of roughly 10-25% is typical — but this varies by lender and borrower profile.",
  },
  {
    q: "Does the down payment cover everything I need upfront?",
    a: "No — you'll also typically need to budget separately for stamp duty, registration charges, and other one-time costs, which aren't included in the down payment itself.",
  },
];

export default function DownPaymentCalculatorPage() {
  return (
    <StaticPageLayout title="Down Payment Calculator">
      <PageSection heading="Calculate your down payment">
        <DownPaymentForm />
      </PageSection>
      <PageSection heading="How this is calculated">
        <p className="m-0">
          Given a property price and either a loan-to-value percentage or a desired loan amount, this calculator
          works out the remaining amount you&apos;d need to pay upfront as a down payment — simply the property price
          minus the loan amount.
        </p>
        <p className="m-0">
          This doesn&apos;t include one-time costs like stamp duty and registration, which are separate from the down
          payment itself.
        </p>
      </PageSection>
      <FaqGroup title="Frequently asked questions" items={FAQS} />
      <JsonLd data={faqPageJsonLd(FAQS.map((f) => ({ q: f.q, a: f.a as string })))} />
    </StaticPageLayout>
  );
}
