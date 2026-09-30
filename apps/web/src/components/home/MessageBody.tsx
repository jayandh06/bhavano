import { Fragment } from "react";
import Link from "next/link";
import { bhavanoSitePath, normalizeUrlForOpening, segmentMessageBody } from "@bhavano/types/messageFormat";

// Renders plain React children only (no dangerouslySetInnerHTML) — the `whitespace-pre-line`
// that makes embedded `\n` visible belongs on the caller's bubble container, matching how
// ListingDetailView applies it directly to the description's own element.
//
// text-inherit on links, not the global `a` default (globals.css: unlayered `a { color:
// var(--green) }` beats any layered Tailwind class) — a link in the sender's own green bubble
// would otherwise render in the same green as its background.
export function MessageBody({ body }: { body: string }) {
  const segments = segmentMessageBody(body);
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "text") return <Fragment key={index}>{segment.value}</Fragment>;
        const sitePath = bhavanoSitePath(segment.value);
        return sitePath ? (
          <Link key={index} href={sitePath} className="underline text-inherit">
            {segment.value}
          </Link>
        ) : (
          <a
            key={index}
            href={normalizeUrlForOpening(segment.value)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-inherit"
          >
            {segment.value}
          </a>
        );
      })}
    </>
  );
}
