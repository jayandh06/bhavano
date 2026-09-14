# Chat message formatting: preserve newlines, linkify URLs

## Context

Bhavano's chat messages (both the mobile app and the web app) render `MessageDto.body`
as raw, unprocessed text. Two problems result:

1. **No newlines.** Neither composer lets a user type a line break in the first place —
   mobile's `TextInput` and web's `<input>` are both single-line, and web's Enter key
   currently sends the message rather than adding a line. Even if a `\n` did make it into
   `body` (e.g. pasted text), web's plain `<div>` collapses it visually (HTML default);
   mobile's `<Text>` actually already preserves `\n` natively — confirmed by
   `apps/mobile/app/listing/[id].tsx:194-198`, which renders `listing.description` the
   same way and displays multi-line descriptions correctly today.
2. **No link detection.** A URL typed into a message renders as flat, unclickable text on
   both platforms — no regex/library exists anywhere in the repo for this today.

This is a rendering + composer-input fix only. `MessageDto.body` stays a plain string;
no backend or Prisma schema change is needed.

## Design

Put the one piece of logic that must behave identically on both platforms — splitting a
message body into a sequence of plain-text vs. URL segments — in the shared
`@bhavano/types` package, which already holds runtime helpers like `slugify.ts`
(not just type defs). Each app gets a small presentational component that consumes those
segments and renders them the platform-appropriate way, mirroring the app's existing
divergence for the same underlying problem (RN `<Text>` preserves `\n` for free; web needs
explicit `whitespace-pre-line`, as already used in `ListingDetailView.tsx:175-181`).

No new dependency — plain regex + JSX.

### 1. `packages/types/src/messageFormat.ts` (new)

```ts
export type MessageSegment = { type: "text"; value: string } | { type: "url"; value: string };

export function segmentMessageBody(body: string): MessageSegment[]
export function normalizeUrlForOpening(url: string): string
```

- Regex: `/(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi` — only `http://`, `https://`, or a
  bare `www.` prefix match. Deliberately excludes other schemes (e.g. `javascript:`) so
  there's no injection surface on the web `<a href>`.
- Walk matches with `.exec()` in a loop, alternating `text`/`url` segments from the
  gaps and the matches — standard tokenize-around-regex-matches approach.
- Trailing-punctuation trim on each raw match before it becomes a `url` segment:
  - Strip trailing `.,!?;:'"` (sentence punctuation stuck to the URL with no space).
  - Strip a trailing `)` only if unbalanced (more `)` than `(` in the match) — so
    `(https://x.com)` excludes the `)`, but `.../wiki/Foo_(bar)` keeps it.
  - Stripped characters aren't a separate segment — they just don't extend the `url`
    segment, so they fall into the next `text` slice naturally; segments still alternate.
- `\n` is never inside a URL match (`[^\s...]` excludes whitespace), so a URL followed by
  a newline and more text splits correctly without special-casing.
- `normalizeUrlForOpening`: returns the value as-is if it already starts with
  `http(s)://`; otherwise prefixes `https://` (the `www.` case). Used only at
  click/tap time — displayed text is always exactly what was typed.

**Wiring it up** — follow the package's actual existing convention (verified in
`packages/types/package.json`): helpers are *not* re-exported from `index.ts`; each gets
its own subpath entry (e.g. `"./slugify"`), and consumers import
`from "@bhavano/types/slugify"`. Add a matching `"./messageFormat"` entry.

**Build step** — `packages/types/dist/**` is committed to git so apps resolve it without a
build hook. After adding the source file and the `exports` entry, run
`pnpm --filter @bhavano/types build` and commit the generated
`dist/messageFormat.js` + `.d.ts` alongside the source.

### 2. `apps/mobile/src/components/home/MessageBody.tsx` (new)

Renders nested `<Text>`: URL segments get `onPress={() => Linking.openURL(normalizeUrlForOpening(seg.value))}` and an underline style. No separate link color needed — a
nested `<Text>` inherits the outer `style`'s color, so it reads correctly on both the
"mine" (green) and "theirs" (surfaceAlt) bubble automatically. Newlines need no handling
here since RN `<Text>` already preserves them.

### 3. `apps/mobile/app/(tabs)/messages/[id].tsx`

- Line 147: replace the raw `<Text>{item.body}</Text>` bubble content with
  `<MessageBody body={item.body} style={{ color: isMine ? colors.onGreen : colors.text, fontSize: 14 }} />`.
- Lines 153-159 (composer `TextInput`): add `multiline`. With no `onSubmitEditing`/
  `blurOnSubmit` wired, RN's default behavior for a multiline input's return key is to
  insert `\n` — the existing dedicated Send button remains the only way to submit.
  `onSend()` (lines 72-77) needs no change; `draft.trim()` only trims the ends.

### 4. `apps/web/src/components/home/MessageBody.tsx` (new)

Renders plain React children — URL segments as
`<a href={normalizeUrlForOpening(seg.value)} target="_blank" rel="noopener noreferrer" className="underline">`,
text segments as plain strings. No `dangerouslySetInnerHTML` anywhere, so no new XSS
surface. No wrapping element with `whitespace-pre-line` inside this component — that class
belongs on the existing bubble `<div>`, mirroring how `ListingDetailView.tsx` applies it
directly to the description's own container rather than a nested wrapper.

### 5. `apps/web/src/components/home/MessageThread.tsx`

- Lines 83-91: add `whitespace-pre-line break-words` to the bubble `<div>`'s className
  (`break-words` so a long bare URL wraps instead of overflowing the 70%-width bubble),
  and swap `{m.body}` for `<MessageBody body={m.body} />`.
- Lines 98-104: replace the single-line `<input>` with an auto-growing `<textarea>`:
  - A `useRef` + a `useEffect` on `[draft]` that resets `el.style.height = "auto"` then
    sets it to `min(scrollHeight, 128px)` — standard scrollHeight auto-grow technique, no
    dependency needed. This also shrinks it back to one row after `onSend()` clears `draft`.
  - `onKeyDown`: if `Enter` and not `shiftKey`, `preventDefault()` and call `onSend()`
    (matches today's send trigger); Shift+Enter falls through to the textarea's default
    newline-insert behavior. `onSend()` itself (lines 56-64) is unchanged.

### Files intentionally untouched

`apps/bff/**`, `apps/bff/prisma/schema.prisma`, `MessageDto` in
`packages/types/src/index.ts` — no backend or schema change.

## Verification

**Mobile** (via the `run` skill / Expo dev client):
1. In a thread, type a message spanning multiple lines using the on-screen return key
   (e.g. `Hi` / `Can we meet` / `tomorrow?`) — composer should grow, Send should not fire
   on return.
2. Send it — the bubble should show 3 real lines, not one collapsed line.
3. Send `Check this out https://example.com/foo and www.example.org.` — both links
   underlined and tappable; the `https://` one opens `https://example.com/foo` (no
   trailing period); the `www.` one opens `https://www.example.org` (prefixed, no
   trailing period).
4. Send `See https://example.com (official site).` — link stops at `.com`, doesn't
   swallow ` (official`.
5. Check an incoming message (second test account) renders the same way, with the link
   legible against the other bubble color too.

**Web** (`pnpm --filter web dev` or the `run` skill):
1. Type a multi-line message using Shift+Enter between lines — textarea grows, no send.
2. Press plain Enter — message sends, bubble shows real line breaks, textarea collapses
   back to one row.
3. Send `Check https://example.com/foo?a=1 and www.example.org.` — both become clickable
   `<a target="_blank">` tags, `www.` one points at `https://www.example.org`, trailing
   periods excluded from both hrefs (check via link hover/"Copy link").
4. Send `https://en.wikipedia.org/wiki/Foo_(bar)` — closing `)` stays part of the href
   (balanced-parens case).
5. Paste a long, space-free URL — confirm it wraps inside the bubble instead of
   overflowing.
6. Confirm via DevTools that no `dangerouslySetInnerHTML` is used and the rendered
   `href` is the normalized string, not raw HTML.
