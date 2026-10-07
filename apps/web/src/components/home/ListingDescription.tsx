import { Fragment } from "react";
import { parseListingDescription } from "@bhavano/types/listingDescriptionFormat";

/**
 * Renders a listing's description with the limited formatting the AI "Generate" assist is
 * instructed to produce (see listing-copy-prompts.ts): paragraph breaks, **bold** highlights,
 * and "- " bullet lists. Plain React children only (no dangerouslySetInnerHTML), same convention
 * as MessageBody — parseListingDescription already did the splitting, this only lays blocks out.
 *
 * A hand-typed description with no markdown-ish syntax parses as a single plain paragraph, so
 * this is a drop-in replacement for the old `whitespace-pre-line` div — nothing changes for text
 * that never uses the convention.
 */
export function ListingDescription({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parseListingDescription(text);
  return (
    <div className={`text-sm text-text-soft leading-[1.6] ${className}`}>
      {blocks.map((block, blockIndex) => {
        if (block.type === "bullets") {
          return (
            <ul key={blockIndex} className="list-disc pl-5 mb-3 last:mb-0 space-y-1">
              {block.items.map((runs, itemIndex) => (
                <li key={itemIndex}>
                  {runs.map((run, runIndex) => (
                    <Fragment key={runIndex}>{run.bold ? <strong className="text-text">{run.text}</strong> : run.text}</Fragment>
                  ))}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="mb-3 last:mb-0">
            {block.runs.map((run, runIndex) => (
              <Fragment key={runIndex}>{run.bold ? <strong className="text-text">{run.text}</strong> : run.text}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
