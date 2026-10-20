export interface ToolInfo {
  slug: string;
  title: string;
  description: string;
}

/** The six calculators, in the order the website's /tools page lists them. The slug is the
 * website path's last segment, so a web link can be mapped to its native screen. */
export const TOOLS: ToolInfo[] = [
  {
    slug: "emi-calculator",
    title: "EMI Calculator",
    description: "Estimate your monthly home loan installment from the loan amount, interest rate, and tenure.",
  },
  {
    slug: "home-loan-eligibility-calculator",
    title: "Home Loan Eligibility",
    description: "See roughly how large a home loan you could qualify for, based on your income and existing EMIs.",
  },
  {
    slug: "area-unit-converter",
    title: "Area Unit Converter",
    description: "Convert property area between square feet, square metres, acres, hectares, and cents.",
  },
  {
    slug: "rent-affordability-calculator",
    title: "Rent Affordability",
    description: "Get a suggested maximum monthly rent based on your income and comfort level.",
  },
  {
    slug: "rent-vs-buy-calculator",
    title: "Rent vs. Buy",
    description: "Compare the total cost of renting against buying a home over a horizon you choose.",
  },
  {
    slug: "down-payment-calculator",
    title: "Down Payment Calculator",
    description: "Work out the down payment you'll need from either a target loan-to-value % or a desired loan amount.",
  },
];
