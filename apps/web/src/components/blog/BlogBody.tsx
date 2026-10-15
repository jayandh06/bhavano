import Link from "next/link";
import { parseInline, type BlogBlock } from "@/lib/blog/posts";

/** Renders text with [label](/path) markers as real links. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.kind === "link" ? (
          <Link key={i} href={part.href} className="text-green font-bold">
            {part.text}
          </Link>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Server-rendered article body. Plain elements only (no client JS): the text has to be in the
 * initial HTML for crawlers, and an article has nothing that needs interactivity. */
export function BlogBody({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={i} className="text-[17px] font-bold text-text m-0 mt-2">
                {block.text}
              </h2>
            );
          case "p":
            return (
              <p key={i} className="m-0">
                <Inline text={block.text} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="m-0 pl-5 flex flex-col gap-1.5 list-disc">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="m-0 pl-5 flex flex-col gap-1.5 list-decimal">
                {block.items.map((item, j) => (
                  <li key={j}>
                    <Inline text={item} />
                  </li>
                ))}
              </ol>
            );
          case "note":
            return (
              <p key={i} className="m-0 rounded-lg border border-border bg-surface-alt px-4 py-3 text-[13px]">
                <Inline text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
