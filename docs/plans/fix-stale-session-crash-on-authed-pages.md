# Fix: stale session crashes favourites/messages/profile/my-listings pages

## Context

The BFF issues a JWT access token with a 1-hour TTL (see `AdminGuard`/`AuthGuard` comments in
`apps/bff/src/auth/guards/auth.guard.ts`), and NextAuth (`apps/web/src/auth.ts`) stores that
token inside its own longer-lived `session.strategy: "jwt"` cookie. There is no refresh flow, so
once the embedded BFF token expires (e.g. after a stale tab, or after the app/container
restarts), NextAuth still reports the user as "logged in" (`session.accessToken` is present) but
every BFF call with that token gets rejected with `401 Login required`.

`bffFetch` (`apps/web/src/lib/bff.ts`) turns that 401 into a plain `throw new Error("Login
required")`. The pages that call authed BFF endpoints — favourites, messages, profile,
my-listings — do so with **no try/catch**, so this throws all the way up through the Server
Component render. There's no `error.tsx` anywhere in `apps/web/src/app`, so Next.js falls back to
its generic crash UI ("This page couldn't load / A server error occurred"), matching exactly what
was seen in the `web-1` container logs.

The app already has an established, working pattern for "not logged in" on every one of these
pages: render `<RequireLoginPrompt message="..."/>` (`apps/web/src/components/home/
RequireLoginPrompt.tsx`), which calls `useAuthGate().requireLogin()` to pop the existing login
modal (`AuthGateProvider.tsx`). Since Next.js Server Actions auto-refresh the current route's
Server Components after they resolve, once the modal's `verifyOtpAction`/
`signInWithGoogleAction` sets a fresh NextAuth cookie, these pages naturally re-render with the
new token — no extra plumbing needed.

**Decision (confirmed with user):** ship the reactive fix only — catch the stale-token 401
wherever it can surface and show the existing login prompt/modal instead of crashing, plus a
global `error.tsx` safety net. A proactive refresh-token flow (BFF refresh endpoint + NextAuth
`jwt` callback silent refresh) is explicitly out of scope for this change; users will still need
to re-authenticate roughly hourly on a stale tab, but via a clean prompt instead of a crash.

## Changes

### 1. Distinguish auth failures in `apps/web/src/lib/bff.ts`

Add a dedicated error class and throw it specifically for 401s in `bffFetch`, keeping the
existing message-parsing logic:

```ts
export class BffAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BffAuthError";
  }
}
```

In `bffFetch`, when `res.status === 401`, throw `new BffAuthError(parsedMessage ?? "Login
required")` instead of the generic `Error`. Leave all other non-2xx handling unchanged.

### 2. Catch it in the four "grid/list" pages

`apps/web/src/app/favourites/page.tsx`, `apps/web/src/app/messages/page.tsx`,
`apps/web/src/app/profile/page.tsx`, `apps/web/src/app/my-listings/page.tsx` all share the same
shape: an inline `async function XGrid({ accessToken })` sub-component that calls the authed bff
function directly. For each, wrap the call:

```ts
async function FavouritesGrid({ accessToken }: { accessToken: string }) {
  try {
    const favourites = await fetchFavourites(accessToken);
    if (favourites.length === 0) return <p ...>No favourites yet...</p>;
    return <div ...>{...}</div>;
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to see the listings you've favourited." />;
    }
    throw error;
  }
}
```

Reuse the exact prompt message already used in that page's `!session?.accessToken` branch above
it, so the UX is identical whether the user was never logged in or their session just went stale.
Apply the same pattern to `ConversationList` (messages), `ProfileFields` (profile), and
`MyListingsGrid` (my-listings) — check `apps/web/src/app/profile/page.tsx` and
`apps/web/src/app/my-listings/page.tsx` for their exact current shape (not yet read, but the
explore pass confirmed they follow this identical `auth()` + inline-async-subcomponent pattern)
before editing.

### 3. `apps/web/src/app/messages/[id]/page.tsx`

This page doesn't use `RequireLoginPrompt` at all — it already `redirect("/messages")`s when
`!session?.accessToken`. Wrap `fetchMessages` the same way but redirect on the auth error too, to
stay consistent with this page's existing (different) convention rather than introducing a new
one just here:

```ts
let messages;
try {
  messages = await fetchMessages(session.accessToken, id);
} catch (error) {
  if (error instanceof BffAuthError) redirect("/messages");
  throw error;
}
```

### 4. `apps/web/src/app/my-listings/[id]/edit/page.tsx`

Currently swallows *any* error from `fetchMyListing` into `notFound()` — so a stale token
incorrectly shows "listing not found" instead of a login prompt. Fix by checking the error type
first:

```ts
async function EditListingFields({ accessToken, id }: { accessToken: string; id: string }) {
  try {
    const listing = await fetchMyListing(accessToken, id);
    return <EditListingForm listing={listing} />;
  } catch (error) {
    if (error instanceof BffAuthError) {
      return <RequireLoginPrompt message="Log in to edit this listing." />;
    }
    notFound();
  }
}
```

### 5. Server Actions that currently throw uncaught

- `apps/web/src/app/actions/messaging.ts` — `sendMessageAction` and `markReadAction` call
  `sendMessage`/`markConversationRead` with no try/catch. Give them a discriminated return type
  matching the convention already used elsewhere in this file (`StartConversationResult`):

  ```ts
  export type SendMessageResult = { requiresLogin: true } | { requiresLogin: false };

  export async function sendMessageAction(conversationId: string, body: string): Promise<SendMessageResult> {
    const session = await auth();
    if (!session?.accessToken) return { requiresLogin: true };
    try {
      await sendMessage(session.accessToken, conversationId, body);
      return { requiresLogin: false };
    } catch (error) {
      if (error instanceof BffAuthError) return { requiresLogin: true };
      throw error;
    }
  }
  ```

  Do the same shape for `markReadAction` (also return the union, but since it's a fire-and-forget
  background call in `MessageThread`'s `useEffect`, the caller there doesn't need to branch on it
  — just stop it from throwing uncaught).

  Update `apps/web/src/components/home/MessageThread.tsx`'s `onSend()` to react to the result:

  ```ts
  const { requireLogin } = useAuthGate();
  ...
  async function onSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const result = await sendMessageAction(conversationId, body);
    if (result.requiresLogin) requireLogin();
  }
  ```

- `apps/web/src/app/actions/users.ts` — `fetchProfileAction` already returns
  `ProfileActionResult` (`{requiresLogin: true} | {requiresLogin: false, profile}`) for the
  missing-session case, but doesn't catch a mid-call `BffAuthError` from `fetchProfile`. Wrap it
  so a stale token also resolves to `{ requiresLogin: true }`:

  ```ts
  export async function fetchProfileAction(): Promise<ProfileActionResult> {
    const session = await auth();
    if (!session?.accessToken) return { requiresLogin: true };
    try {
      return { requiresLogin: false, profile: await fetchProfile(session.accessToken) };
    } catch (error) {
      if (error instanceof BffAuthError) return { requiresLogin: true };
      throw error;
    }
  }
  ```

- `apps/web/src/app/actions/listings.ts` — `fetchMyListingsAction` returns `[]` for the
  missing-session case but doesn't catch a mid-call auth failure; wrap similarly, returning `[]`
  on `BffAuthError` too (matches its existing degrade-to-empty convention), rethrowing anything
  else.

Leave the other actions in these files alone — `createListingAction`, `updateListingAction`,
`updateProfileAction`, `toggleFavouriteAction`, `startConversationAction`, `uploadPhotoAction`
already catch and surface `error.message` as an inline error string via their existing
`{success, error}`/`{error}` result shapes, which is adequate (these are user-triggered mutations
where "please log in and retry" as inline text is a reasonable outcome, not a full-page crash
risk since they're invoked from already-interactive client forms, not raw RSC renders).

### 6. Global safety net: `apps/web/src/app/error.tsx`

Add a `"use client"` error boundary (required by Next.js for `error.tsx`) so any *other*,
not-yet-covered thrown error (or a genuine future bug) shows a friendly page instead of Next's
raw crash screen, directly addressing the "This page couldn't load" symptom as a last resort:

```tsx
"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-5 bg-bg text-text">
      <p className="text-sm text-text-soft mb-4">Something went wrong. Please try again.</p>
      <button
        onClick={reset}
        className="bg-green text-on-green border-0 rounded-lg px-7 py-3 text-sm font-bold cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
```

Keep it minimal (no `PageHeader`/`Footer`/data fetching) — `error.tsx` boundaries render without
their layout's data dependencies being guaranteed safe, and Next.js requires this file to be a
Client Component.

## Files touched

- `apps/web/src/lib/bff.ts` — add `BffAuthError`, throw it on 401
- `apps/web/src/app/favourites/page.tsx`
- `apps/web/src/app/messages/page.tsx`
- `apps/web/src/app/messages/[id]/page.tsx`
- `apps/web/src/app/profile/page.tsx`
- `apps/web/src/app/my-listings/page.tsx`
- `apps/web/src/app/my-listings/[id]/edit/page.tsx`
- `apps/web/src/app/actions/messaging.ts`
- `apps/web/src/app/actions/users.ts`
- `apps/web/src/app/actions/listings.ts`
- `apps/web/src/components/home/MessageThread.tsx`
- `apps/web/src/app/error.tsx` (new)

## Verification

1. `pnpm --filter web typecheck` (or the repo's equivalent) to confirm no type errors from the
   new `BffAuthError` import/usage across all touched files.
2. Manual end-to-end repro, run locally:
   - Log in, then manually shorten the loop: either wait out the BFF token's TTL, or temporarily
     hand-edit the NextAuth session cookie/JWT secret mismatch to force a 401, or simplest —
     stop/restart the `bff` container with a different `AUTH_JWT_SECRET` so the existing token no
     longer verifies (same effect as the reported "after restarting the application" case).
   - Visit `/favourites`, `/messages`, `/messages/[id]` (with an existing conversation id),
     `/profile`, `/my-listings`, and `/my-listings/[id]/edit` — each should show the login
     prompt/modal (or redirect to `/messages` for the conversation-detail page) instead of a
     crash page.
   - Log back in via the modal and confirm the page's real content (favourites/conversations/etc)
     appears without a manual browser refresh, verifying the Server Action auto-refresh behavior
     described in Context holds.
   - Send a message from an open conversation with a deliberately staled token and confirm the
     login modal pops instead of the message silently vanishing.
3. Confirm `apps/web/src/app/error.tsx` renders by temporarily throwing an unrelated error in any
   RSC page, loading it, then reverting the temporary throw.
