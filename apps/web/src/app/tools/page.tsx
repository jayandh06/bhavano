import { StaticPageLayout } from "@/components/home/StaticPageLayout";
import { ToolCard } from "@/components/tools/ToolCard";
import type { IconName } from "@/components/home/Icon";

export const metadata = {
  title: "Free Property Calculators — Bhavano",
  description:
    "Free calculators for home buyers and renters: EMI, home loan eligibility, area unit conversion, rent affordability, rent vs. buy, and down payment.",
};

const TOOLS: { href: string; icon: IconName; title: string; description: string }[] = [
  {
    href: "/tools/emi-calculator",
    icon: "calculator",
    title: "EMI Calculator",
    description: "Estimate your monthly home loan installment from the loan amount, interest rate, and tenure.",
  },
  {
    href: "/tools/home-loan-eligibility-calculator",
    icon: "chart",
    title: "Home Loan Eligibility",
    description: "See roughly how large a home loan you could qualify for, based on your income and existing EMIs.",
  },
  {
    href: "/tools/area-unit-converter",
    icon: "ruler",
    title: "Area Unit Converter",
    description: "Convert property area between square feet, square metres, acres, hectares, and cents.",
  },
  {
    href: "/tools/rent-affordability-calculator",
    icon: "home",
    title: "Rent Affordability",
    description: "Get a suggested maximum monthly rent based on your income and comfort level.",
  },
  {
    href: "/tools/rent-vs-buy-calculator",
    icon: "scale",
    title: "Rent vs. Buy",
    description: "Compare the total cost of renting against buying a home over a horizon you choose.",
  },
  {
    href: "/tools/down-payment-calculator",
    icon: "rupee",
    title: "Down Payment Calculator",
    description: "Work out the down payment you'll need from either a target loan-to-value % or a desired loan amount.",
  },
];

export default function ToolsIndexPage() {
  return (
    <StaticPageLayout title="Free property calculators">
      <p className="m-0">
        Quick, free calculators to help you plan a purchase or rental — every result here is an estimate, not
        financial advice.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
      </div>
    </StaticPageLayout>
  );
}
