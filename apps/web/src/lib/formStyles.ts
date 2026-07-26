/** Shared form styling — the single source of truth for input/label/button classes used by
 * every hand-rolled form in the app (PostAdWizard, SavedSearchesManager, the Tools calculators).
 * There's no component library here, just Tailwind utility strings; keeping them here instead of
 * copy-pasted per-file is what lets a style tweak apply everywhere at once. */
export const fieldClass = "w-full border border-border rounded-[9px] px-3.5 py-3 text-sm outline-none bg-surface text-text";

export const labelClass = "text-[13px] font-bold text-text-soft mb-1.5 block";

export const primaryButtonClass =
  "bg-green text-on-green border-0 rounded-lg px-6 py-3 text-sm font-bold cursor-pointer disabled:opacity-60";

export const secondaryButtonClass = "bg-transparent border-0 text-muted text-[13px] font-bold cursor-pointer disabled:opacity-60";

export const outlineButtonClass =
  "text-[13px] font-bold text-green border-[1.5px] border-green rounded-lg px-4 py-2.5 cursor-pointer bg-transparent";
