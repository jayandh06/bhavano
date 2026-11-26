/** Shown at the top of the US Terms and Privacy pages until counsel has reviewed them (docs/plans/us-legal-pages.md). Remove it from those pages at launch. */
export function DraftNotice() {
  return (
    <p className="m-0 mb-4 rounded-md border border-[color:var(--gold)] bg-white/60 px-3 py-2 text-[13px] text-muted">
      <strong className="text-text">Draft.</strong> This page is a working draft that has not yet been reviewed by a lawyer. Text in [square
      brackets] is still to be confirmed.
    </p>
  );
}
