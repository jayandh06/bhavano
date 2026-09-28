"use client";

import { useEffect, useMemo, useState } from "react";
import type { Area, RefineRequirementInput, RequirementAnswers, RequirementDto } from "@bhavano/types";
import { convertArea, type AreaUnit } from "@bhavano/types/areaUnit";
import { bedroomLabel } from "@bhavano/types/bedrooms";
import { formatInrWithWords } from "@bhavano/types/priceWords";
import {
  INTENT_CATEGORIES,
  INTENT_TRANSACTION_CHOICES,
  MAX_REQUIREMENT_AREAS,
  REQUIREMENT_ATTRIBUTE_QUESTIONS,
  REQUIREMENT_BEDROOM_OPTIONS,
  REQUIREMENT_CATEGORY_LABELS,
  REQUIREMENT_INTENTS,
  REQUIREMENT_TIMELINE_OPTIONS,
  REQUIRED_REQUIREMENT_STEPS,
  amenityOptionsFor,
  answeredSteps,
  applicableSteps,
  applyIntent,
  budgetPresetsFor,
  canLeaveStep,
  formatRequirementLabel,
  intentOf,
  sanitizeRequirementAttributes,
  sizeQuestionFor,
  stepsToAsk,
  type RequirementCriteria,
  type RequirementStep,
} from "@bhavano/types/requirementQuestions";
import { refineRequirementAction } from "@/app/actions/requirements";
import { listAllAreasAction } from "@/app/actions/locations";
import { RequirementCityPicker, type PickedCity } from "./RequirementCityPicker";

type WizardStep = RequirementStep | "review";

const STEP_TITLES: Record<WizardStep, string> = {
  city: "Which city?",
  intent: "What are you looking for?",
  category: "What type of property?",
  details: "A few specifics",
  areas: "Which areas?",
  budget: "What's your budget?",
  amenities: "Any must-haves?",
  timeline: "When do you need it?",
  review: "Does this look right?",
};

const AREA_UNIT_SHORT: Record<AreaUnit, string> = { sqft: "sq ft", sqm: "sq m", acre: "acres", hectare: "hectares", cent: "cents" };

/** How far a suggested area may be from one already picked. */
const NEARBY_KM = 6;

/** What the questions start from: a saved requirement, or (before anything is saved) the search
 * the capture card was shown for. */
export type RequirementWizardSubject = Pick<
  RequirementDto,
  | "category"
  | "transactionType"
  | "cityId"
  | "cityName"
  | "areaIds"
  | "areaNames"
  | "bedroomOptions"
  | "minPrice"
  | "maxPrice"
  | "minAreaSqft"
  | "maxAreaSqft"
  | "areaUnit"
  | "attributes"
  | "moveInBy"
  | "note"
  | "contactConsent"
>;

/** `create`: nothing is saved until the review, which creates the requirement with every answer
 * at once. `refine`: an older, saved requirement, patched as each step is answered. */
export type RequirementWizardMode =
  | { kind: "create"; create: (answers: RequirementAnswers) => Promise<RequirementDto> }
  | { kind: "refine"; id: string };

function criteriaOf(r: RequirementWizardSubject): RequirementCriteria {
  return {
    category: r.category,
    transactionType: r.transactionType,
    cityId: r.cityId,
    areaIds: r.areaIds,
    bedroomOptions: r.bedroomOptions,
    minPrice: r.minPrice,
    maxPrice: r.maxPrice,
    minAreaSqft: r.minAreaSqft,
    maxAreaSqft: r.maxAreaSqft,
    areaUnit: r.areaUnit,
    attributes: r.attributes,
    moveInBy: r.moveInBy,
  };
}

function distanceKm(a: Area, b: Area): number {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return Infinity;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function parseAmount(raw: string): number | undefined {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? Number(digits) : undefined;
}

function parseSize(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
}

function toUnit(sqft: number | undefined, unit: AreaUnit): string {
  return sqft === undefined ? "" : String(Math.round(convertArea(sqft, "sqft", unit) * 100) / 100);
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

/**
 * The questions asked after "Yes, find this for me" — docs/plans/requirement-refinement-questions.md.
 *
 * From the capture card this runs in `create` mode: the requirement is created at the review, with
 * every answer, so there is never a half-filled one — closing early saves nothing. The
 * /my-requirements refine page runs it in `refine` mode over an older, saved row, saving each step.
 * Steps the search already answered are skipped (decided once, when this opens, so answering one
 * question never makes another vanish). City, areas, what and property type must be answered — a
 * requirement is vague without them — and every later step can be skipped, "any" being an
 * acceptable answer there.
 */
export function RequirementRefineWizard({
  requirement,
  mode,
  onFinished,
  onClose,
}: {
  requirement: RequirementWizardSubject;
  mode: RequirementWizardMode;
  /** Called with the saved requirement after the review step. */
  onFinished: (requirement: RequirementDto) => void;
  /** Called when the seeker stops early. */
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<RequirementWizardSubject>(requirement);
  const [draft, setDraft] = useState<RequirementCriteria>(() => criteriaOf(requirement));
  const skipped = useMemo(() => answeredSteps(criteriaOf(requirement)), [requirement]);
  const steps: WizardStep[] = [...stepsToAsk(draft, skipped), "review"];
  const [stepKey, setStepKey] = useState<WizardStep>(steps[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickedCity, setPickedCity] = useState<PickedCity | undefined>(() =>
    requirement.cityId && requirement.cityName ? { id: requirement.cityId, name: requirement.cityName } : undefined,
  );
  /** Keyed by city, so a new city's step never shows the old city's list while its own loads. */
  const [cityAreas, setCityAreas] = useState<{ cityId: string; list: Area[] } | null>(null);
  const [areaQuery, setAreaQuery] = useState("");
  const [sizeUnit, setSizeUnit] = useState<AreaUnit>(requirement.areaUnit ?? "sqft");
  const [sizeMin, setSizeMin] = useState(() => toUnit(requirement.minAreaSqft, requirement.areaUnit ?? "sqft"));
  const [sizeMax, setSizeMax] = useState(() => toUnit(requirement.maxAreaSqft, requirement.areaUnit ?? "sqft"));
  const [budgetMin, setBudgetMin] = useState(requirement.minPrice?.toString() ?? "");
  const [budgetMax, setBudgetMax] = useState(requirement.maxPrice?.toString() ?? "");
  const [timeline, setTimeline] = useState<string | null>(null);
  const [note, setNote] = useState(requirement.note ?? "");

  const savedCityId = current.cityId;
  useEffect(() => {
    if (!savedCityId) return;
    let cancelled = false;
    void listAllAreasAction(savedCityId).then((list) => {
      if (!cancelled) setCityAreas({ cityId: savedCityId, list: [...list].sort((a, b) => a.name.localeCompare(b.name)) });
    });
    return () => {
      cancelled = true;
    };
  }, [savedCityId]);
  const areas = cityAreas && cityAreas.cityId === savedCityId ? cityAreas.list : null;

  const intent = intentOf(draft.category, draft.transactionType);
  const areaById = useMemo(() => new Map((areas ?? []).map((a) => [a.id, a])), [areas]);
  const selectedAreaNames = (draft.areaIds ?? []).map(
    (id) => areaById.get(id)?.name ?? current.areaNames[current.areaIds.indexOf(id)] ?? "",
  );
  const position = steps.indexOf(stepKey);

  function detailsPatch() {
    const min = parseSize(sizeMin);
    const max = parseSize(sizeMax);
    return {
      bedroomOptions: draft.bedroomOptions ?? [],
      minAreaSqft: min === undefined ? null : Math.round(convertArea(min, sizeUnit, "sqft")),
      maxAreaSqft: max === undefined ? null : Math.round(convertArea(max, sizeUnit, "sqft")),
      areaUnit: min === undefined && max === undefined ? null : sizeUnit,
      attributes: draft.category
        ? sanitizeRequirementAttributes(draft.category, draft.transactionType, draft.attributes ?? {}).attributes
        : undefined,
    };
  }

  function budgetPatch() {
    return { minPrice: parseAmount(budgetMin) ?? null, maxPrice: parseAmount(budgetMax) ?? null };
  }

  function patchFor(step: WizardStep): RefineRequirementInput {
    const attributes = draft.category
      ? sanitizeRequirementAttributes(draft.category, draft.transactionType, draft.attributes ?? {}).attributes
      : undefined;
    switch (step) {
      case "city":
        return { cityId: draft.cityId };
      case "intent":
      case "category":
        return { category: draft.category ?? null, transactionType: draft.transactionType ?? null };
      case "details":
        return detailsPatch();
      case "areas":
        return { areaIds: draft.areaIds ?? [] };
      case "budget":
        return budgetPatch();
      case "amenities":
        return { attributes };
      case "timeline": {
        const option = REQUIREMENT_TIMELINE_OPTIONS.find((o) => o.value === timeline);
        return {
          ...(option ? { moveInBy: option.days ? daysFromNow(option.days) : null } : {}),
          note: note.trim() || null,
        };
      }
      case "review":
        return { complete: true };
    }
  }

  /** Every answer, as the create call wants them. Criteria the category has no use for (a BHK
   * set after switching to Plot) are left out, as the BFF would drop them anyway. */
  function answersOf(): RequirementAnswers {
    const timeline = patchFor("timeline");
    return {
      ...criteriaAnswers(),
      moveInBy: timeline.moveInBy === undefined ? current.moveInBy : (timeline.moveInBy ?? undefined),
      note: timeline.note ?? undefined,
    };
  }

  /** The answers without the timeline — what the review's label is written from. The timeline
   * reads the clock, so it is only worked out when the button is pressed, never while rendering. */
  function criteriaAnswers(): RequirementAnswers {
    const details = detailsPatch();
    const budget = budgetPatch();
    const size = draft.category ? sizeQuestionFor(draft.category) : undefined;
    return {
      cityId: draft.cityId ?? "",
      category: draft.category,
      transactionType: draft.transactionType,
      areaIds: draft.areaIds ?? [],
      bedroomOptions: size?.kind === "bedrooms" ? details.bedroomOptions : [],
      minAreaSqft: size?.kind === "area" ? (details.minAreaSqft ?? undefined) : undefined,
      maxAreaSqft: size?.kind === "area" ? (details.maxAreaSqft ?? undefined) : undefined,
      areaUnit: size?.kind === "area" ? (details.areaUnit ?? undefined) : undefined,
      attributes: details.attributes,
      minPrice: budget.minPrice ?? undefined,
      maxPrice: budget.maxPrice ?? undefined,
    };
  }

  async function save(step: WizardStep): Promise<RequirementDto | null> {
    if (mode.kind !== "refine") return null;
    setSaving(true);
    setError(null);
    const result = await refineRequirementAction(mode.id, patchFor(step));
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return null;
    }
    setCurrent(result.requirement);
    setDraft(criteriaOf(result.requirement));
    return result.requirement;
  }

  async function create() {
    if (mode.kind !== "create") return;
    setSaving(true);
    setError(null);
    try {
      onFinished(await mode.create(answersOf()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that — try again");
      setSaving(false);
    }
  }

  /** `from` is the criteria just saved when there are some: choosing Buy adds the property-type
   * step, choosing PG removes it, and a new city empties the areas. */
  function goNext(from: RequirementCriteria = draft) {
    const next = [...stepsToAsk(from, skipped), "review" as const];
    const at = next.indexOf(stepKey);
    // A step opened from the review's "Change" links may be one the search had answered, so it is
    // not in the sequence. It returns to the first step still needing an answer, or the review.
    setStepKey(at === -1 ? (next.find((s) => s !== "review" && !canLeaveStep(s, from)) ?? "review") : (next[at + 1] ?? "review"));
  }

  async function saveAndNext() {
    if (mode.kind === "create") {
      if (stepKey === "review") return create();
      // The areas list follows the city once the city step is left, as it does after a save.
      if (stepKey === "city" && pickedCity) setCurrent((c) => ({ ...c, cityId: pickedCity.id, cityName: pickedCity.name }));
      goNext();
      return;
    }
    if (stepKey === "review") {
      const saved = await save("review");
      if (saved) onFinished(saved);
      return;
    }
    const saved = await save(stepKey);
    if (saved) goNext(criteriaOf(saved));
  }

  function goBack() {
    if (position === -1) setStepKey("review");
    else if (position > 0) setStepKey(steps[position - 1]);
  }

  function toggleIn(list: string[] | undefined, value: string, multi: boolean): string[] {
    const set = list ?? [];
    if (set.includes(value)) return set.filter((v) => v !== value);
    return multi ? [...set, value] : [value];
  }

  function setAttribute(key: string, values: string[]) {
    setDraft((d) => ({ ...d, attributes: { ...(d.attributes ?? {}), [key]: values } }));
  }

  // --- step bodies -------------------------------------------------------------------------

  function CityStep() {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12.5px] text-muted">Start with the city — we&apos;ll ask which areas next.</p>
        <RequirementCityPicker
          value={pickedCity}
          onChange={(city) => {
            setPickedCity(city);
            setDraft((d) => (d.cityId === city.id ? d : { ...d, cityId: city.id, areaIds: [] }));
          }}
          disabled={saving}
        />
      </div>
    );
  }

  function IntentStep() {
    const choices = intent ? INTENT_TRANSACTION_CHOICES[intent] : undefined;
    return (
      <>
        <ChipRow>
          {REQUIREMENT_INTENTS.map((option) => (
            <Chip
              key={option.value}
              active={intent === option.value}
              onClick={() => setDraft((d) => ({ ...d, ...applyIntent(option.value, d) }))}
            >
              {option.label}
            </Chip>
          ))}
        </ChipRow>
        {choices && (
          <div className="mt-4">
            <Label>{intent === "furniture" ? "Buy or rent?" : "Rent or lease?"}</Label>
            <ChipRow>
              {choices.map((option) => (
                <Chip
                  key={option.value}
                  active={draft.transactionType === option.value}
                  onClick={() => setDraft((d) => ({ ...d, transactionType: option.value }))}
                >
                  {option.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}
      </>
    );
  }

  function CategoryStep() {
    const options = intent ? INTENT_CATEGORIES[intent] : [];
    return (
      <ChipRow>
        {options.map((category) => (
          <Chip key={category} active={draft.category === category} onClick={() => setDraft((d) => ({ ...d, category }))}>
            {REQUIREMENT_CATEGORY_LABELS[category]}
          </Chip>
        ))}
      </ChipRow>
    );
  }

  function DetailsStep() {
    if (!draft.category) return null;
    const size = sizeQuestionFor(draft.category);
    const questions = REQUIREMENT_ATTRIBUTE_QUESTIONS[draft.category].filter(
      (q) => !q.transactionTypes || (draft.transactionType && q.transactionTypes.includes(draft.transactionType)),
    );
    return (
      <div className="flex flex-col gap-4">
        {size?.kind === "bedrooms" && (
          <div>
            <Label>{size.label} <Hint>pick all that work</Hint></Label>
            <ChipRow>
              {REQUIREMENT_BEDROOM_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  active={draft.bedroomOptions?.includes(n) ?? false}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      bedroomOptions: toggleIn(d.bedroomOptions?.map(String), String(n), true).map(Number),
                    }))
                  }
                >
                  {bedroomLabel(n)} BHK
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}
        {size?.kind === "area" && (
          <div>
            <Label>{size.label}</Label>
            <div className="flex items-center gap-2 w-full">
              <input
                inputMode="decimal"
                value={sizeMin}
                onChange={(e) => setSizeMin(e.target.value)}
                placeholder="Min"
                className={`${inputClass} flex-1 min-w-0`}
                aria-label="Smallest size"
              />
              <span className="text-muted text-[13px]">to</span>
              <input
                inputMode="decimal"
                value={sizeMax}
                onChange={(e) => setSizeMax(e.target.value)}
                placeholder="Max"
                className={`${inputClass} flex-1 min-w-0`}
                aria-label="Largest size"
              />
              {size.units.length > 1 ? (
                <select
                  value={sizeUnit}
                  onChange={(e) => setSizeUnit(e.target.value as AreaUnit)}
                  className={inputClass}
                  aria-label="Unit"
                >
                  {size.units.map((unit) => (
                    <option key={unit} value={unit}>
                      {AREA_UNIT_SHORT[unit]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-muted text-[13px]">{AREA_UNIT_SHORT[size.units[0]]}</span>
              )}
            </div>
          </div>
        )}
        {questions.map((q) => (
          <div key={q.key}>
            <Label>
              {q.label} {q.multi && <Hint>pick all that work</Hint>}
            </Label>
            <ChipRow>
              {q.options.map((option) => (
                <Chip
                  key={option.value}
                  active={draft.attributes?.[q.key]?.includes(option.value) ?? false}
                  onClick={() => setAttribute(q.key, toggleIn(draft.attributes?.[q.key], option.value, q.multi))}
                >
                  {option.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        ))}
      </div>
    );
  }

  function AreasStep() {
    const selected = draft.areaIds ?? [];
    const full = selected.length >= MAX_REQUIREMENT_AREAS;
    const query = areaQuery.trim().toLowerCase();
    const matches = (areas ?? []).filter((a) => !selected.includes(a.id) && (!query || a.name.toLowerCase().includes(query)));
    const picked = selected.map((id) => areaById.get(id)).filter((a): a is Area => Boolean(a));
    const nearby = picked.length
      ? (areas ?? [])
          .filter((a) => !selected.includes(a.id))
          .map((a) => ({ area: a, km: Math.min(...picked.map((p) => distanceKm(p, a))) }))
          .filter((x) => x.km <= NEARBY_KM)
          .sort((x, y) => x.km - y.km)
          .slice(0, 5)
          .map((x) => x.area)
      : [];
    const toggle = (id: string) =>
      setDraft((d) => ({ ...d, areaIds: toggleIn(d.areaIds, id, true).slice(0, MAX_REQUIREMENT_AREAS) }));

    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12.5px] text-muted">
          Pick 1 to {MAX_REQUIREMENT_AREAS}. Owners and agents can only help when you name the areas you&apos;d actually live in.
        </p>
        {selected.length > 0 && (
          <ChipRow>
            {selected.map((id, i) => (
              <Chip key={id} active onClick={() => toggle(id)}>
                {selectedAreaNames[i] || "Area"} ✕
              </Chip>
            ))}
          </ChipRow>
        )}
        {nearby.length > 0 && !full && (
          <div>
            <Label>Also consider nearby</Label>
            <ChipRow>
              {nearby.map((a) => (
                <Chip key={a.id} active={false} onClick={() => toggle(a.id)}>
                  + {a.name}
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}
        <input
          value={areaQuery}
          onChange={(e) => setAreaQuery(e.target.value)}
          placeholder={`Search areas in ${current.cityName ?? "the city"}`}
          className={inputClass}
          disabled={full}
        />
        {areas === null ? (
          <p className="m-0 text-[12.5px] text-muted">Loading areas…</p>
        ) : (
          !full && (
            <div className="max-h-[220px] md:max-h-[320px] overflow-auto overscroll-contain border border-border rounded-lg divide-y divide-border">
              {matches.slice(0, 40).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="block w-full text-left bg-surface px-3 py-2 pointer-coarse:py-3 text-[13px] text-text border-none cursor-pointer hover:bg-surface-alt"
                >
                  {a.name}
                </button>
              ))}
              {matches.length === 0 && <p className="m-0 px-3 py-2 text-[12.5px] text-muted">No area by that name.</p>}
            </div>
          )
        )}
      </div>
    );
  }

  function BudgetStep() {
    const { unit, presets } = budgetPresetsFor(draft.category, draft.transactionType);
    const min = parseAmount(budgetMin);
    const max = parseAmount(budgetMax);
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12.5px] text-muted">In rupees, {unit}.</p>
        <ChipRow>
          {presets.map((p) => (
            <Chip
              key={p.label}
              active={min === p.min && max === p.max}
              onClick={() => {
                setBudgetMin(p.min?.toString() ?? "");
                setBudgetMax(p.max?.toString() ?? "");
              }}
            >
              {p.label}
            </Chip>
          ))}
        </ChipRow>
        <div className="grid grid-cols-2 gap-3 w-full">
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[11.5px] text-muted font-bold">From ₹</span>
            <input inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className={`${inputClass} w-full`} />
            {min !== undefined && <span className="text-[11.5px] text-muted">{formatInrWithWords(min)}</span>}
          </label>
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[11.5px] text-muted font-bold">Up to ₹</span>
            <input inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className={`${inputClass} w-full`} />
            {max !== undefined && <span className="text-[11.5px] text-muted">{formatInrWithWords(max)}</span>}
          </label>
        </div>
      </div>
    );
  }

  function AmenitiesStep() {
    if (!draft.category) return null;
    return (
      <ChipRow>
        {amenityOptionsFor(draft.category).map((option) => (
          <Chip
            key={option.value}
            active={draft.attributes?.amenities?.includes(option.value) ?? false}
            onClick={() => setAttribute("amenities", toggleIn(draft.attributes?.amenities, option.value, true))}
          >
            {option.label}
          </Chip>
        ))}
      </ChipRow>
    );
  }

  function TimelineStep() {
    return (
      <div className="flex flex-col gap-3">
        <ChipRow>
          {REQUIREMENT_TIMELINE_OPTIONS.map((option) => (
            <Chip key={option.value} active={timeline === option.value} onClick={() => setTimeline(option.value)}>
              {option.label}
            </Chip>
          ))}
        </ChipRow>
        {timeline === null && current.moveInBy && (
          <p className="m-0 text-[12.5px] text-muted">
            Currently: needed by {new Date(current.moveInBy).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </p>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] text-muted font-bold">Anything else? (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Near a metro station, ground floor, pet friendly…"
            className={inputClass}
          />
        </label>
      </div>
    );
  }

  function ReviewStep() {
    const label = formatRequirementLabel(criteriaAnswers(), { cityName: current.cityName, areaNames: selectedAreaNames.filter(Boolean) });
    const editable = applicableSteps(draft);
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-surface-alt px-3.5 py-2.5 text-[13.5px] font-semibold text-text">{label}</div>
        <div className="flex gap-2 flex-wrap">
          {editable.map((step) => (
            <button key={step} type="button" onClick={() => setStepKey(step)} className={linkButtonClass}>
              Change {STEP_LINK_LABELS[step]}
            </button>
          ))}
        </div>
        <p className="m-0 text-[12.5px] text-muted">
          {current.contactConsent
            ? "Owners and agents with a matching property may call or message you."
            : "Only Bhavano will contact you — your number stays with us."}
        </p>
      </div>
    );
  }

  const body: Record<WizardStep, () => React.ReactNode> = {
    city: CityStep,
    intent: IntentStep,
    category: CategoryStep,
    details: DetailsStep,
    areas: AreasStep,
    budget: BudgetStep,
    amenities: AmenitiesStep,
    timeline: TimelineStep,
    review: ReviewStep,
  };

  const counted = steps.length - 1;
  return (
    <div
      className="flex flex-col gap-4 w-full"
      // Phone browsers don't reliably scroll a field inside a fixed, scrolling dialog into view when
      // the on-screen keyboard opens, so do it once the keyboard has had time to take its space.
      onFocusCapture={(e) => {
        const target = e.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
        }
      }}
    >
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="text-[11.5px] text-muted font-bold uppercase tracking-wide">
            {stepKey === "review" ? "Review" : position === -1 ? "Edit" : `Step ${position + 1} of ${counted}`}
          </div>
          <div className="font-lora text-lg font-bold mt-0.5">
            {stepKey === "areas" && current.cityName ? `Which areas of ${current.cityName}?` : STEP_TITLES[stepKey]}
          </div>
        </div>
        <button type="button" onClick={onClose} className={`${linkButtonClass} shrink-0`} aria-label="Close">
          Close
        </button>
      </div>

      {body[stepKey]()}

      {error && <p className="m-0 text-[12.5px] text-danger">{error}</p>}

      {/* Sticky so Next stays reachable under a long area list, whether the scroller is the
          dialog or (on the refine page) the window. City, areas, what and property type have no
          Skip: without them a requirement is too vague for anyone to act on. */}
      <div className="sticky bottom-0 z-10 -mb-1 flex items-center gap-3 border-t border-border bg-surface pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {position !== 0 && (
          <button type="button" onClick={goBack} disabled={saving} className={`${linkButtonClass} shrink-0`}>
            Back
          </button>
        )}
        <div className="flex-1" />
        {stepKey !== "review" && !REQUIRED_REQUIREMENT_STEPS.has(stepKey) && (
          <button type="button" onClick={() => goNext()} disabled={saving} className={`${linkButtonClass} min-w-0 truncate`}>
            Skip
          </button>
        )}
        <button
          type="button"
          onClick={() => void saveAndNext()}
          disabled={saving || (stepKey !== "review" && !canLeaveStep(stepKey, draft))}
          className={`${primaryButtonClass} shrink-0`}
        >
          {saving ? "Saving…" : stepKey !== "review" ? "Next" : mode.kind === "create" ? "Find this for me" : "Done"}
        </button>
      </div>
    </div>
  );
}

const STEP_LINK_LABELS: Record<RequirementStep, string> = {
  city: "city",
  intent: "what",
  category: "type",
  details: "specifics",
  areas: "areas",
  budget: "budget",
  amenities: "must-haves",
  timeline: "timeline",
};

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 flex-wrap">{children}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 pointer-coarse:min-h-11 pointer-coarse:px-3.5 text-[13px] cursor-pointer ${
        active ? "border-green bg-surface-alt text-text font-bold" : "border-border bg-surface text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-muted font-bold mb-1.5">{children}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="font-normal">· {children}</span>;
}

/** 16px on phones, as in lib/formStyles.ts: iOS Safari zooms the page into any focused input under
 * 16px and doesn't reliably zoom back out. */
const inputClass =
  "border border-border rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-[13.5px] bg-surface text-text outline-none focus:border-green";

const primaryButtonClass =
  "bg-green text-on-green border-none rounded-lg px-5 py-2.5 pointer-coarse:py-3 text-[13.5px] font-bold cursor-pointer disabled:opacity-60";

const linkButtonClass =
  "bg-transparent border-none px-0 py-1 pointer-coarse:min-h-11 text-[13px] text-muted underline cursor-pointer disabled:opacity-60";
