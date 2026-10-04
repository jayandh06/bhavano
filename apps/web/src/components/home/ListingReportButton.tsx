"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { ReportDialog } from "./ReportDialog";

/** A small icon-button entry point for ReportDialog, kept as its own client component so the
 * (async, Server Component) ListingDetailView doesn't need client state of its own just to
 * toggle a dialog open. Mirrors the mobile app's flag icon in the listing screen's header — see
 * docs/plans/mobile-ugc-report-and-block.md. */
export function ListingReportButton({
  listingTitle,
  listingUrl,
  defaultName,
}: {
  listingTitle: string;
  listingUrl: string;
  defaultName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-text bg-transparent border-0 p-0 cursor-pointer"
      >
        <Icon name="flag" /> Report
      </button>
      {open && (
        <ReportDialog
          topic="listing_report"
          context={`Listing: ${listingTitle}`}
          listingUrl={listingUrl}
          defaultName={defaultName ?? undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
