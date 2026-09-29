import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ListingCategory, TransactionType } from "@bhavano/types";
import { convertArea, formatArea } from "@bhavano/types/areaUnit";
import { bedroomLabel } from "@bhavano/types/bedrooms";
import { slugify } from "@bhavano/types/slugify";
import {
  decodeRequirementFeedQuery,
  encodeRequirementFeedQuery,
  type RequirementFeedCardDto,
  type RequirementFeedDto,
  type RequirementFeedFilters,
  type RequirementFeedMoveIn,
  type RequirementFeedSummaryDto,
} from "@bhavano/types/requirementFeed";
import {
  INTENT_CATEGORIES,
  INTENT_TRANSACTION_CHOICES,
  REQUIREMENT_ATTRIBUTE_QUESTIONS,
  REQUIREMENT_BEDROOM_OPTIONS,
  REQUIREMENT_CATEGORY_LABELS,
  REQUIREMENT_INTENTS,
  amenityOptionsFor,
  budgetPresetsFor,
  formatCompactInr,
  sizeQuestionFor,
  type RequirementIntent,
} from "@bhavano/types/requirementQuestions";
import { auth } from "@/auth";
import { BffAuthError, fetchRequirementFeed, fetchRequirementFeedSummary } from "@/lib/bff";
import { resolvePageCityContext } from "@/lib/pageCityContext";
import { isAccessTokenValid } from "@/lib/session";
import { Footer } from "./Footer";
import { PageHeader } from "./PageHeader";
import { RequireLoginPrompt } from "./RequireLoginPrompt";
import { RequirementsRoleQuestion } from "./RequirementsRoleQuestion";

type SearchParams = Record<string, string | string[] | undefined>;

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the intent itself fixes the transaction, so budget bands can be offered without asking. */
const IMPLIED_TRANSACTION: Partial<Record<RequirementIntent, TransactionType>> = { buy: "sell", pg: "rent" };

const SIZE_PRESETS: Partial<Record<ListingCategory, { label: string; min?: number; max?: number }[]>> = {
  plot: [
    { label: "Under 1,200 sqft", max: 1200 },
    { label: "1,200–2,400 sqft", min: 1200, max: 2400 },
    { label: "2,400–5,000 sqft", min: 2400, max: 5000 },
    { label: "5,000+ sqft", min: 5000 },
  ],
  commercial: [
    { label: "Under 500 sqft", max: 500 },
    { label: "500–1,500 sqft", min: 500, max: 1500 },
    { label: "1,500–5,000 sqft", min: 1500, max: 5000 },
    { label: "5,000+ sqft", min: 5000 },
  ],
  storage: [
    { label: "Under 100 sqft", max: 100 },
    { label: "100–500 sqft", min: 100, max: 500 },
    { label: "500+ sqft", min: 500 },
  ],
};

const MOVE_IN_OPTIONS: { value: RequirementFeedMoveIn; label: string }[] = [
  { value: "now", label: "Immediately" },
  { value: "month", label: "Within a month" },
  { value: "quarter", label: "In 1–3 months" },
  { value: "exploring", label: "Just exploring" },
];

function feedPath(citySlug: string | undefined, f: RequirementFeedFilters): string {
  const query = new URLSearchParams(encodeRequirementFeedQuery(f, false)).toString();
  return `/requirements${citySlug ? `/${citySlug}` : ""}${query ? `?${query}` : ""}`;
}

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];
  return next.length ? next : undefined;
}

/** A different intent means a different set of questions, so everything below it resets. */
function withIntent(f: RequirementFeedFilters, intent: RequirementIntent | undefined): RequirementFeedFilters {
  const { areas, postedWithinDays, moveIn, openToCalls, matchesMyListings, sort } = f;
  return { areas, postedWithinDays, moveIn, openToCalls, matchesMyListings, sort, intent };
}

function withTransaction(f: RequirementFeedFilters, transactionType: TransactionType | undefined): RequirementFeedFilters {
  return { ...f, transactionType, minBudget: undefined, maxBudget: undefined, attributes: undefined };
}

function withCategory(f: RequirementFeedFilters, category: ListingCategory | undefined): RequirementFeedFilters {
  return { ...f, category, bedrooms: undefined, minSqft: undefined, maxSqft: undefined, attributes: undefined, amenities: undefined };
}

function postedAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function budgetText(card: RequirementFeedCardDto): string | null {
  const { minPrice, maxPrice } = card;
  if (minPrice && maxPrice) return `${formatCompactInr(minPrice)}–${formatCompactInr(maxPrice)} ${card.budgetUnit}`;
  if (maxPrice) return `Up to ${formatCompactInr(maxPrice)} ${card.budgetUnit}`;
  if (minPrice) return `From ${formatCompactInr(minPrice)} ${card.budgetUnit}`;
  return null;
}

function sizeText(card: RequirementFeedCardDto): string | null {
  const unit = card.areaUnit ?? "sqft";
  const show = (sqft: number) => formatArea(Math.round(convertArea(sqft, "sqft", unit) * 100) / 100, unit);
  if (card.minAreaSqft && card.maxAreaSqft) return `${show(card.minAreaSqft)} – ${show(card.maxAreaSqft)}`;
  if (card.maxAreaSqft) return `Up to ${show(card.maxAreaSqft)}`;
  if (card.minAreaSqft) return `At least ${show(card.minAreaSqft)}`;
  return null;
}

function moveInText(iso: string | undefined): string {
  if (!iso) return "Just exploring";
  const date = new Date(iso);
  return date.getTime() <= Date.now() ? "Needs it now" : `Move in by ${dateFormatter.format(date)}`;
}

/**
 * The owner/agent Requirements tab — docs/plans/requirements-feed-for-owners-agents.md.
 *
 * Signed out: counts only. Signed in but not yet an owner or agent: one question, which also fills
 * in the seller type most accounts never set. Owners and agents: every lead-ready requirement,
 * filtered by city and then by the questions that fit the chosen transaction and property type.
 * The filters are plain links, so the whole page works server-rendered.
 */
export async function RequirementsFeedPage({ citySlug, searchParams }: { citySlug?: string; searchParams: SearchParams }) {
  const [session, { city, cityAreas, allCities }] = await Promise.all([auth(), resolvePageCityContext(citySlug)]);
  if (citySlug && !city) notFound();

  // The city comes from the path; a stray ?city= is ignored.
  const filters = decodeRequirementFeedQuery(searchParams);
  delete filters.city;
  const areaIdBySlug = new Map(cityAreas.map((area) => [slugify(area.name), area.id]));
  const areaIds = filters.areas?.map((slug) => areaIdBySlug.get(slug)).filter((id): id is string => Boolean(id));
  const bffQuery = encodeRequirementFeedQuery({ ...filters, city: city?.id, areas: city && areaIds?.length ? areaIds : undefined });
  const selfPath = feedPath(citySlug, filters);

  const accessToken = session?.accessToken;
  let feed: RequirementFeedDto | null = null;
  let loginNeeded = !isAccessTokenValid(accessToken);
  if (!loginNeeded) {
    try {
      feed = await fetchRequirementFeed(accessToken!, bffQuery);
    } catch (error) {
      if (!(error instanceof BffAuthError)) throw error;
      loginNeeded = true;
    }
  }
  const summary = !feed?.eligible ? await fetchRequirementFeedSummary(city?.id).catch(() => null) : null;

  return (
    <div className="min-h-screen flex flex-col bg-bg text-text">
      <PageHeader cityName={city?.name} />
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-20">
        <h1 className="font-lora text-2xl font-semibold m-0 mb-1.5">
          Requirements{city ? ` in ${city.name}` : ""}
        </h1>
        <p className="text-muted text-[13.5px] m-0 mb-6 max-w-[720px]">
          What buyers and tenants are looking for right now. If you have something that fits, post it and
          they&apos;ll hear about it.
        </p>

        {loginNeeded ? (
          <>
            {summary && <SummaryCounts summary={summary} citySlug={citySlug} />}
            <RequireLoginPrompt
              message="Own property or work as an agent? Log in to see what people are looking for."
              redirectTo={selfPath}
            />
          </>
        ) : feed && !feed.eligible ? (
          <>
            <RequirementsRoleQuestion />
            {summary && <SummaryCounts summary={summary} citySlug={citySlug} />}
          </>
        ) : feed ? (
          <div className="grid gap-6 lg:grid-cols-[300px_1fr] items-start">
            <FeedFilters feed={feed} filters={filters} citySlug={citySlug} cityName={city?.name} />
            <FeedResults feed={feed} filters={filters} citySlug={citySlug} cityName={city?.name} />
          </div>
        ) : null}
      </div>
      <Footer currentCityName={city?.name} cityAreas={cityAreas} allCities={allCities} />
    </div>
  );
}

function SummaryCounts({ summary, citySlug }: { summary: RequirementFeedSummaryDto; citySlug?: string }) {
  if (summary.total === 0) return null;
  const intentLabel = (intent: RequirementIntent) => REQUIREMENT_INTENTS.find((i) => i.value === intent)?.label ?? intent;
  return (
    <div className="border border-border rounded-xl bg-surface p-5 mb-6">
      <div className="font-bold text-[15px] mb-3">
        {summary.total} open requirement{summary.total === 1 ? "" : "s"}
        {citySlug ? "" : " across India"}
      </div>
      {summary.types.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {summary.types.map((type) => (
            <span key={`${type.intent}:${type.category}`} className="text-[12.5px] bg-surface-alt rounded-full px-3 py-1">
              {intentLabel(type.intent)} · {REQUIREMENT_CATEGORY_LABELS[type.category]} ({type.count})
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        {summary.cities.map((c) => (
          <Link key={c.cityId} href={`/requirements/${slugify(c.cityName)}`} prefetch={false} className="text-green">
            {c.cityName} ({c.count})
          </Link>
        ))}
      </div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[12.5px] no-underline whitespace-nowrap ${
        active ? "border-green bg-green text-on-green" : "border-border bg-surface text-text-soft hover:border-green"
      }`}
    >
      {children}
    </Link>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FeedFilters({
  feed,
  filters,
  citySlug,
  cityName,
}: {
  feed: RequirementFeedDto;
  filters: RequirementFeedFilters;
  citySlug?: string;
  cityName?: string;
}) {
  const href = (f: RequirementFeedFilters, slug = citySlug) => feedPath(slug, f);
  const withoutPlace = { ...filters, areas: undefined };
  const intent = filters.intent;
  const transactionChoices = intent ? INTENT_TRANSACTION_CHOICES[intent] : undefined;
  const transaction = filters.transactionType ?? (intent ? IMPLIED_TRANSACTION[intent] : undefined);
  const categories = intent ? INTENT_CATEGORIES[intent] : [];
  const category = filters.category ?? (categories.length === 1 ? categories[0] : undefined);
  const showBudget = Boolean(intent && (!transactionChoices || filters.transactionType));
  const size = category ? sizeQuestionFor(category) : undefined;
  const questions = category
    ? REQUIREMENT_ATTRIBUTE_QUESTIONS[category].filter((q) => !q.transactionTypes || (transaction && q.transactionTypes.includes(transaction)))
    : [];
  const amenities = category ? amenityOptionsFor(category) : [];
  const hasFilters = Object.keys(encodeRequirementFeedQuery(filters, false)).length > 0;

  return (
    <aside className="border border-border rounded-xl bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-[14px]">Filters</span>
        {(hasFilters || citySlug) && (
          <Link href="/requirements" prefetch={false} className="text-[12.5px] text-green">
            Clear all
          </Link>
        )}
      </div>

      <FilterGroup title="City">
        <Chip href={href(withoutPlace, undefined)} active={!citySlug}>
          All cities
        </Chip>
        {citySlug && cityName && !feed.facets.cities.some((c) => slugify(c.cityName) === citySlug) && (
          <Chip href={href(withoutPlace)} active>
            {cityName} (0)
          </Chip>
        )}
        {feed.facets.cities.map((c) => {
          const slug = slugify(c.cityName);
          return (
            <Chip key={c.cityId} href={href(withoutPlace, slug)} active={slug === citySlug}>
              {c.cityName} ({c.count})
            </Chip>
          );
        })}
      </FilterGroup>

      {citySlug && feed.facets.areas.length > 0 && (
        <FilterGroup title="Areas">
          {feed.facets.areas.map((a) => {
            const slug = slugify(a.name);
            return (
              <Chip key={a.areaId} href={href({ ...filters, areas: toggle(filters.areas, slug) })} active={Boolean(filters.areas?.includes(slug))}>
                {a.name} ({a.count})
              </Chip>
            );
          })}
        </FilterGroup>
      )}

      <FilterGroup title="Looking to">
        <Chip href={href(withIntent(filters, undefined))} active={!intent}>
          Any
        </Chip>
        {REQUIREMENT_INTENTS.map((i) => (
          <Chip key={i.value} href={href(withIntent(filters, i.value))} active={intent === i.value}>
            {i.label} ({feed.facets.intents[i.value] ?? 0})
          </Chip>
        ))}
      </FilterGroup>

      {transactionChoices && (
        <FilterGroup title="Transaction">
          <Chip href={href(withTransaction(filters, undefined))} active={!filters.transactionType}>
            Any
          </Chip>
          {transactionChoices.map((t) => (
            <Chip key={t.value} href={href(withTransaction(filters, t.value))} active={filters.transactionType === t.value}>
              {t.label}
            </Chip>
          ))}
        </FilterGroup>
      )}

      {categories.length > 1 && (
        <FilterGroup title="Property type">
          <Chip href={href(withCategory(filters, undefined))} active={!filters.category}>
            Any
          </Chip>
          {categories.map((c) => (
            <Chip key={c} href={href(withCategory(filters, c))} active={filters.category === c}>
              {REQUIREMENT_CATEGORY_LABELS[c]} ({feed.facets.categories[c] ?? 0})
            </Chip>
          ))}
        </FilterGroup>
      )}

      {showBudget && (
        <FilterGroup title={`Budget (${budgetPresetsFor(category, transaction).unit})`}>
          {budgetPresetsFor(category, transaction).presets.map((p) => {
            const active = filters.minBudget === p.min && filters.maxBudget === p.max;
            return (
              <Chip
                key={p.label}
                href={href(active ? { ...filters, minBudget: undefined, maxBudget: undefined } : { ...filters, minBudget: p.min, maxBudget: p.max })}
                active={active}
              >
                {p.label}
              </Chip>
            );
          })}
        </FilterGroup>
      )}

      {size?.kind === "bedrooms" && (
        <FilterGroup title="BHK">
          {REQUIREMENT_BEDROOM_OPTIONS.map((n) => (
            <Chip key={n} href={href({ ...filters, bedrooms: toggle(filters.bedrooms, n) })} active={Boolean(filters.bedrooms?.includes(n))}>
              {bedroomLabel(n)} BHK
            </Chip>
          ))}
        </FilterGroup>
      )}

      {size?.kind === "area" && category && SIZE_PRESETS[category] && (
        <FilterGroup title={size.label}>
          {SIZE_PRESETS[category]!.map((p) => {
            const active = filters.minSqft === p.min && filters.maxSqft === p.max;
            return (
              <Chip
                key={p.label}
                href={href(active ? { ...filters, minSqft: undefined, maxSqft: undefined } : { ...filters, minSqft: p.min, maxSqft: p.max })}
                active={active}
              >
                {p.label}
              </Chip>
            );
          })}
        </FilterGroup>
      )}

      {questions.map((q) => (
        <FilterGroup key={q.key} title={q.label}>
          {q.options.map((o) => {
            const current = filters.attributes?.[q.key];
            const active = Boolean(current?.includes(o.value));
            const nextValues = toggle(current, o.value);
            const attributes = { ...filters.attributes, [q.key]: nextValues ?? [] };
            if (!nextValues) delete attributes[q.key];
            return (
              <Chip
                key={o.value}
                href={href({ ...filters, attributes: Object.keys(attributes).length ? attributes : undefined })}
                active={active}
              >
                {o.label}
              </Chip>
            );
          })}
        </FilterGroup>
      ))}

      {amenities.length > 0 && (
        <FilterGroup title="Your property has">
          {amenities.map((o) => (
            <Chip key={o.value} href={href({ ...filters, amenities: toggle(filters.amenities, o.value) })} active={Boolean(filters.amenities?.includes(o.value))}>
              {o.label}
            </Chip>
          ))}
        </FilterGroup>
      )}

      <details
        open={Boolean(filters.moveIn || filters.postedWithinDays || filters.openToCalls || filters.matchesMyListings)}
        className="group"
      >
        <summary className="cursor-pointer text-[12.5px] font-bold text-green mb-3 list-none">
          <span className="group-open:hidden">More filters ▾</span>
          <span className="hidden group-open:inline">Fewer filters ▴</span>
        </summary>
        <FilterGroup title="Move-in">
          {MOVE_IN_OPTIONS.map((o) => (
            <Chip key={o.value} href={href({ ...filters, moveIn: filters.moveIn === o.value ? undefined : o.value })} active={filters.moveIn === o.value}>
              {o.label}
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup title="Posted">
          <Chip href={href({ ...filters, postedWithinDays: undefined })} active={!filters.postedWithinDays}>
            Any time
          </Chip>
          <Chip href={href({ ...filters, postedWithinDays: 7 })} active={filters.postedWithinDays === 7}>
            Last 7 days
          </Chip>
          <Chip href={href({ ...filters, postedWithinDays: 30 })} active={filters.postedWithinDays === 30}>
            Last 30 days
          </Chip>
        </FilterGroup>

        <FilterGroup title="More">
          <Chip href={href({ ...filters, openToCalls: filters.openToCalls ? undefined : true })} active={Boolean(filters.openToCalls)}>
            Open to calls
          </Chip>
          {feed.hasListings && (
            <Chip
              href={href({ ...filters, matchesMyListings: filters.matchesMyListings ? undefined : true })}
              active={Boolean(filters.matchesMyListings)}
            >
              Only ones my listings fit
            </Chip>
          )}
        </FilterGroup>
      </details>
    </aside>
  );
}

function FeedResults({
  feed,
  filters,
  citySlug,
  cityName,
}: {
  feed: RequirementFeedDto;
  filters: RequirementFeedFilters;
  citySlug?: string;
  cityName?: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <span className="text-[13.5px] text-muted">
          {feed.total === 0
            ? "No requirements match"
            : feed.items.length < feed.total
              ? `Showing ${feed.items.length} of ${feed.total}`
              : `${feed.total} requirement${feed.total === 1 ? "" : "s"}`}
        </span>
        <div className="flex gap-1.5">
          <Chip href={feedPath(citySlug, { ...filters, sort: undefined })} active={filters.sort !== "soonest"}>
            Newest
          </Chip>
          <Chip href={feedPath(citySlug, { ...filters, sort: "soonest" })} active={filters.sort === "soonest"}>
            Moving in soonest
          </Chip>
        </div>
      </div>

      {feed.items.length === 0 ? (
        <div className="border border-border rounded-xl bg-surface p-7 text-center">
          <p className="m-0 mb-4 text-[13.5px] text-muted">
            {cityName
              ? `Nothing matches in ${cityName} right now. New requirements come in every day, so check back, or widen the filters.`
              : "Nothing matches right now. New requirements come in every day, so check back, or widen the filters."}
          </p>
          <Link href="/requirements" prefetch={false} className="text-green font-bold text-[13.5px]">
            See all requirements →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {feed.items.map((card) => (
            <FeedCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedCard({ card }: { card: RequirementFeedCardDto }) {
  const facts = [
    card.bedroomOptions.length ? `${card.bedroomOptions.map(bedroomLabel).join(", ")} BHK` : null,
    budgetText(card),
    sizeText(card),
    moveInText(card.moveInBy),
  ].filter((fact): fact is string => Boolean(fact));
  const postParams = new URLSearchParams({ category: card.category, transactionType: card.transactionType });
  if (card.cityName) postParams.set("city", slugify(card.cityName));

  return (
    <article className="border border-border rounded-xl bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-lora text-[17px] font-bold m-0">{card.label}</h2>
        <span
          className={`shrink-0 text-[11.5px] font-bold rounded-full px-2.5 py-1 ${
            card.openToCalls ? "bg-green/10 text-green" : "bg-surface-alt text-muted"
          }`}
        >
          {card.openToCalls ? "Open to calls" : "Messages only"}
        </span>
      </div>
      <div className="text-[13px] text-muted mt-1">
        {[card.areaNames.join(", "), card.cityName].filter(Boolean).join(" · ")}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {facts.map((fact) => (
          <span key={fact} className="text-[12.5px] bg-surface-alt rounded-full px-3 py-1">
            {fact}
          </span>
        ))}
        {card.details.map((d) => (
          <span key={d.label} className="text-[12.5px] bg-surface-alt rounded-full px-3 py-1">
            {d.label}: {d.values.join(", ")}
          </span>
        ))}
      </div>
      {card.unanswered.length > 0 && <p className="text-[12px] text-muted m-0 mt-2">{card.unanswered.join(" · ")}</p>}

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[12px] text-muted">
          Posted {postedAgo(card.createdAt)}
          {card.updatedAt ? ` · updated ${postedAgo(card.updatedAt)}` : ""}
          {card.matchingListingCount > 0 && (
            <>
              {" · "}
              <Link href="/my-listings" prefetch={false} className="text-green">
                {card.matchingListingCount === 1 ? "1 of your listings fits" : `${card.matchingListingCount} of your listings fit`}
              </Link>
            </>
          )}
          {" · contact details aren't shared"}
        </span>
        <Link
          href={`/post?${postParams.toString()}`}
          prefetch={false}
          className="bg-green text-on-green rounded-lg px-4 py-2 text-[13px] font-bold no-underline"
        >
          Post a matching ad
        </Link>
      </div>
    </article>
  );
}
