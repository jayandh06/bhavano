import Link from "next/link";
import type { City, ListingCategory } from "@bhavano/types";
import { JsonLd } from "@/components/JsonLd";
import { buildBrowsePath } from "@/lib/listingPath";
import { CATEGORY_LABELS, type TransactionGroup } from "@/lib/seoRoute";
import { sortedPosts } from "@/lib/blog/posts";
import { HOME_STEPS, homeFaqs } from "@bhavano/types/homeContent";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://local.bhavano.com";

const BUY: { group: TransactionGroup; category: ListingCategory }[] = [
  { group: "buy", category: "apartment" },
  { group: "buy", category: "house" },
  { group: "buy", category: "villa" },
  { group: "buy", category: "plot" },
  { group: "buy", category: "commercial" },
];
const RENT: { group: TransactionGroup; category: ListingCategory }[] = [
  { group: "rent-lease", category: "apartment" },
  { group: "rent-lease", category: "house" },
  { group: "rent-lease", category: "villa" },
  { group: "rent-lease", category: "commercial" },
  { group: "rent-lease", category: "pg" },
  { group: "rent-lease", category: "coworking" },
  { group: "rent-lease", category: "storage" },
];

const TOOLS = [
  { href: "/tools/emi-calculator", label: "EMI calculator" },
  { href: "/tools/rent-affordability-calculator", label: "Rent affordability calculator" },
  { href: "/tools/rent-vs-buy-calculator", label: "Rent vs buy calculator" },
  { href: "/tools/area-unit-converter", label: "Area unit converter" },
];

/** Plain, server-rendered sections under the homepage's listings: category and city links, how it
 * works, owner call to action, tools and guides, and a visible FAQ with matching FAQPage markup.
 * They exist for people who scroll past the grid and for crawlers and answer engines, which need
 * real text and real links on the page rather than a grid alone. Shown only on the plain `/` view
 * (no filters, no city, page 1), where this content is true; filtered views stay as they are. */
export function HomeSeoSections({ popularCities }: { popularCities: City[] }) {
  const faqs = homeFaqs(popularCities.map((c) => c.name));

  const guides = sortedPosts().slice(0, 4);
  // py-1.5 + block gives a finger-sized tap target on a phone without changing the desktop look much.
  const linkClass = "block py-1.5 text-[14px] text-text no-underline hover:underline";
  const h2 = "font-lora text-[20px] font-semibold m-0 mb-3 text-text";

  return (
    <div className="mt-14 max-w-[1100px] flex flex-col gap-10">
      <JsonLd
        data={{
          "@type": "WebSite",
          name: "Bhavano",
          url: SITE_URL,
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?q={search_term_string}` },
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <JsonLd
        data={{
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }}
      />

      <section aria-label="Browse by category">
        <h2 className={h2}>Browse properties by category</h2>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div>
            <h3 className="text-[14px] font-bold m-0 mb-2 text-text">Buy</h3>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {BUY.map(({ group, category }) => (
                <li key={`${group}-${category}`}>
                  <Link href={buildBrowsePath({ transactionGroup: group, category })} className={linkClass}>
                    {CATEGORY_LABELS[category]} for sale
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[14px] font-bold m-0 mb-2 text-text">Rent and lease</h3>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {RENT.map(({ group, category }) => (
                <li key={`${group}-${category}`}>
                  <Link href={buildBrowsePath({ transactionGroup: group, category })} className={linkClass}>
                    {CATEGORY_LABELS[category]} for rent
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {popularCities.length > 0 && (
        <section aria-label="Browse by city">
          <h2 className={h2}>Browse listings by city</h2>
          <div className="flex flex-wrap gap-2">
            {popularCities.map((city) => (
              <Link
                key={city.id}
                href={buildBrowsePath({ cityName: city.name })}
                className="bg-surface-alt border border-border rounded-[20px] px-4 py-2 text-[13.5px] text-text no-underline"
              >
                {city.name}
              </Link>
            ))}
            <Link href="/cities" className="px-3.5 py-2 text-[13.5px] font-bold text-green no-underline">
              See all cities
            </Link>
          </div>
        </section>
      )}

      <section aria-label="How Bhavano works">
        <h2 className={h2}>How Bhavano works</h2>
        <ol className="m-0 p-0 list-none grid gap-4 sm:grid-cols-3">
          {HOME_STEPS.map((step, i) => (
            <li key={step.title} className="border border-border rounded-xl p-4 bg-surface">
              <div className="text-[12px] font-bold text-muted mb-1">STEP {i + 1}</div>
              <div className="text-[15px] font-bold text-text mb-1">{step.title}</div>
              <p className="m-0 text-[13.5px] text-text-soft leading-relaxed">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 mb-0 text-[13.5px] text-text-soft">
          Every listing is checked before it goes live. Read what we check and what we do not in{" "}
          <Link href="/trust" className="text-green font-bold">
            Trust and Safety
          </Link>
          .
        </p>
      </section>

      <section aria-label="For owners and agents">
        <h2 className={h2}>Own or manage a property?</h2>
        <p className="m-0 mb-3 text-[14px] text-text-soft max-w-[720px] leading-relaxed">
          List a house, flat, plot, PG, coworking desk or commercial space and reach people searching in your city. You
          deal directly with seekers.
        </p>
        <Link
          href="/post"
          className="inline-block bg-green text-on-green rounded-lg px-5 py-3 text-[14px] font-bold no-underline"
        >
          Post your property
        </Link>
      </section>

      <section aria-label="Tools and guides">
        <h2 className={h2}>Free tools and guides</h2>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {TOOLS.map((tool) => (
              <li key={tool.href}>
                <Link href={tool.href} className={linkClass}>
                  {tool.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
            {guides.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`} className={linkClass}>
                  {post.title}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/blog" className="block py-1.5 text-[14px] font-bold text-green no-underline">
                All guides
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section aria-label="Frequently asked questions">
        <h2 className={h2}>Frequently asked questions</h2>
        <dl className="m-0 flex flex-col gap-4 max-w-[760px]">
          {faqs.map((f) => (
            <div key={f.question}>
              <dt className="text-[14.5px] font-bold text-text">{f.question}</dt>
              <dd className="m-0 mt-1 text-[14px] text-text-soft leading-relaxed">{f.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
