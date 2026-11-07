import { diffList, diffWords } from "@/lib/textDiff";

const GREEN_BG = "color-mix(in srgb, var(--green) 20%, transparent)";
const RED_BG = "color-mix(in srgb, var(--danger) 18%, transparent)";

const noteStyle: React.CSSProperties = { fontSize: 12, margin: "5px 0 0", lineHeight: 1.5 };
const addStyle: React.CSSProperties = { background: GREEN_BG, color: "var(--green)", borderRadius: 4, padding: "0 4px", fontWeight: 600 };
const delStyle: React.CSSProperties = { background: RED_BG, color: "var(--danger)", borderRadius: 4, padding: "0 4px", textDecoration: "line-through" };

/** Under a field the admin has edited but not saved: what the edit adds (green) and removes (red) against the saved value.
 * `text` is a word-by-word diff (title, description), `list` shows added and removed items (multi-select, specs), and
 * `value` shows the old value struck through next to the new one. Renders nothing when the two are equal. */
export function ChangeNote({ kind, before, after }: { kind: "text" | "list" | "value"; before: string | string[]; after: string | string[] }) {
  if (kind === "list") {
    const { added, removed } = diffList(Array.isArray(before) ? before : [], Array.isArray(after) ? after : []);
    if (added.length === 0 && removed.length === 0) return null;
    return (
      <p style={{ ...noteStyle, display: "flex", flexWrap: "wrap", gap: 6 }} aria-label="Unsaved changes">
        {added.map((v) => (
          <span key={`a-${v}`} style={addStyle}>+ {v}</span>
        ))}
        {removed.map((v) => (
          <span key={`r-${v}`} style={delStyle}>− {v}</span>
        ))}
      </p>
    );
  }

  const b = Array.isArray(before) ? before.join(", ") : before;
  const a = Array.isArray(after) ? after.join(", ") : after;
  if (b === a) return null;

  if (kind === "text") {
    return (
      <p style={{ ...noteStyle, whiteSpace: "pre-wrap", maxWidth: 720, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px" }} aria-label="Unsaved changes">
        {diffWords(b, a).map((part, i) =>
          part.type === "same" ? <span key={i}>{part.text}</span> : <span key={i} style={part.type === "add" ? addStyle : delStyle}>{part.text}</span>,
        )}
      </p>
    );
  }

  return (
    <p style={noteStyle} aria-label="Unsaved changes">
      {b !== "" && <span style={delStyle}>{b}</span>}
      {b !== "" && a !== "" && <span style={{ color: "var(--muted)" }}> → </span>}
      {a !== "" && <span style={addStyle}>{a}</span>}
    </p>
  );
}
