/** Shown in place of results when the visitor has unchecked every area.
 *
 * Unchecking the last one used to silently re-check the first, which quietly undid the action and
 * showed a result set nobody asked for. This is the honest alternative: the state is real, and
 * the page says what to do about it. Deliberately *not* the empty-search requirement prompt —
 * that one means "we have nothing here", and this means "you haven't told us where yet". A server
 * component, so it costs no client JS. */
export function PickAnAreaNotice() {
  return (
    <div className="my-10 mx-auto max-w-[460px] text-center border border-border rounded-xl bg-surface p-7">
      <div className="font-lora text-lg font-bold mb-1.5">Select at least one area to search</div>
      <p className="text-muted text-[13px] m-0">
        Pick an area from the filter above — or choose <strong>Select all areas</strong> to search the
        whole city.
      </p>
    </div>
  );
}
