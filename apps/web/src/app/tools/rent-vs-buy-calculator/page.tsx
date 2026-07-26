import { StaticPageLayout, PageSection } from "@/components/home/StaticPageLayout";
import { FaqGroup, type Faq } from "@/components/home/FaqGroup";
import { JsonLd } from "@/components/JsonLd";
import { faqPageJsonLd } from "@/lib/faqJsonLd";
import { RentVsBuyForm } from "@/components/tools/RentVsBuyForm";

export const metadata = {
  title: "Rent vs. Buy Calculator — Bhavano",
  description: "Compare the total cost of renting against buying a home over a time horizon you choose.",
};

const FAQS: Faq[] = [
  {
    q: '"Net cost of buying" — what does that actually include?',
    a: "It's your total cash outflow over the horizon (down payment, one-time stamp duty/registration, every EMI paid, and yearly maintenance/property tax), minus your net home equity at the end (the home's estimated value minus any loan still outstanding). In short: what buying actually cost you, after accounting for the asset you still hold.",
  },
  {
    q: "What does this calculator leave out?",
    a: "It doesn't account for: the opportunity cost of investing your down payment elsewhere instead, tax deductions on home loan interest, resale or brokerage costs if you sold the property, or the rental income you'd forgo by living in it instead of renting it out. These are real factors a full financial comparison would include.",
  },
  {
    q: "Is this financial advice?",
    a: "No. This is a simplified planning estimate using assumptions you can adjust (rent increases, appreciation, ownership costs) — actual outcomes depend on your local market and personal finances. Consult a financial advisor for a decision this size.",
  },
  {
    q: "Why isn't this discounted to present value?",
    a: "This calculator adds up nominal rupee amounts across years without adjusting for the time value of money (a rupee paid in year 10 is treated the same as one paid today) — it's a simpler, more intuitive comparison, but a more rigorous analysis would discount future cash flows.",
  },
];

export default function RentVsBuyCalculatorPage() {
  return (
    <StaticPageLayout title="Rent vs. Buy Calculator">
      <PageSection heading="Compare renting vs. buying">
        <RentVsBuyForm />
      </PageSection>
      <PageSection heading="How this is calculated">
        <p className="m-0">
          Over your chosen horizon, this adds up the total rent you&apos;d pay (with an assumed annual increase) and
          compares it to the net cost of buying: your down payment, one-time buying costs, every EMI paid, and yearly
          maintenance/property tax — minus the home equity you&apos;d still hold at the end (estimated property value,
          minus any loan still outstanding). All figures are nominal totals, not adjusted for the time value of
          money.
        </p>
        <p className="m-0">
          <strong>This deliberately excludes:</strong> the opportunity cost of investing your down payment elsewhere,
          home-loan interest tax deductions, resale/brokerage costs on eventually selling the property, and the
          rental income you&apos;d give up by living in it instead of renting it out. These are estimates for planning
          purposes only, not financial advice.
        </p>
      </PageSection>
      <FaqGroup title="Frequently asked questions" items={FAQS} />
      <JsonLd data={faqPageJsonLd(FAQS.map((f) => ({ q: f.q, a: f.a as string })))} />
    </StaticPageLayout>
  );
}
