import { Fragment } from "react";
import { normalizeUrlForOpening, segmentMessageBody } from "@bhavano/types/messageFormat";

// Renders plain React children only (no dangerouslySetInnerHTML) — the `whitespace-pre-line`
// that makes embedded `\n` visible belongs on the caller's bubble container, matching how
// ListingDetailView applies it directly to the description's own element.
export function MessageBody({ body }: { body: string }) {
  const segments = segmentMessageBody(body);
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "url" ? (
          <a
            key={index}
            href={normalizeUrlForOpening(segment.value)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {segment.value}
          </a>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        ),
      )}
    </>
  );
}
