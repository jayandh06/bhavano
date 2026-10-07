import { Fragment } from "react";
import { parseListingDescription } from "@bhavano/types/listingDescriptionFormat";

/** Admin's own copy of web's ListingDescription (apps/web/src/components/home/ListingDescription.tsx)
 * — same parseListingDescription, same block types, just inline styles instead of Tailwind to
 * match this app's convention (see ListingRowDetail.tsx). Renders the limited formatting the AI
 * "Generate" assist is instructed to produce: paragraph breaks, **bold** highlights, "- " bullets.
 * A hand-typed description with no markdown-ish syntax parses as one plain paragraph, so this is
 * a drop-in replacement for the old `whiteSpace: "pre-wrap"` <p> — nothing changes for text that
 * never uses the convention. */
export function ListingDescription({ text }: { text: string }) {
  const blocks = parseListingDescription(text);
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "bullets") {
          return (
            <ul key={blockIndex} style={{ margin: "0 0 8px", paddingLeft: 20 }}>
              {block.items.map((runs, itemIndex) => (
                <li key={itemIndex} style={{ marginBottom: 4 }}>
                  {runs.map((run, runIndex) => (
                    <Fragment key={runIndex}>{run.bold ? <strong>{run.text}</strong> : run.text}</Fragment>
                  ))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} style={{ margin: "0 0 8px" }}>
            {block.runs.map((run, runIndex) => (
              <Fragment key={runIndex}>{run.bold ? <strong>{run.text}</strong> : run.text}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
