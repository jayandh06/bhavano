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
          // text-inherit, not the global `a` default (globals.css: unlayered `a { color:
          // var(--green) }` beats any layered Tailwind class) — a link in the sender's own
          // green bubble would otherwise render in the same green as its background.
          <a
            key={index}
            href={normalizeUrlForOpening(segment.value)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-inherit"
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
