import { Fragment } from "react";
import { normalizeUrlForOpening, segmentMessageBody } from "@bhavano/types/messageFormat";

// Mirrors apps/web/src/components/home/MessageBody.tsx — renders plain React children only (no
// dangerouslySetInnerHTML). The `whiteSpace: "pre-line"` that makes embedded `\n` visible belongs
// on the caller's bubble container, same as web's own version.
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
            style={{ textDecoration: "underline", color: "inherit" }}
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
