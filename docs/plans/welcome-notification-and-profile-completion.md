# Welcome message on first sign-in + profile-completion nudge (web & mobile)

## Context

Two related features:

1. **Send a welcome email/SMS/WhatsApp the first time a user ever signs in**, regardless of
   whether they used the web app or the mobile app. Since both clients authenticate against the
   same BFF endpoints (`POST /auth/otp/verify`, `POST /auth/google`), detecting "first login" and
   sending the welcome message entirely BFF-side means **zero client-specific code is needed** for
   this part — it covers both platforms automatically.
2. **Nudge users to fill in a missing email or phone in their profile, repeatedly until they do**
   — motivated directly by (1): a phone-OTP user has no email (can't get the welcome email), and a
   Google-login user has no phone (can't get the welcome SMS/WhatsApp). This needs UI work on
   *both* platforms. The mobile app's Account screen (`app/(tabs)/account.tsx`) is currently a bare
   stub with no profile-editing form at all (**confirmed with user: build the full mobile profile
   screen too**, not just a banner with nowhere to send the user).

**Confirmed decisions:**
- WhatsApp provider: **MSG91** (already the vendor for OTP + transactional SMS — one vendor
  relationship, `MSG91_AUTH_KEY` already configured). Real sends still require manually registering
  a WhatsApp Business sender + getting a template approved in MSG91's dashboard (same manual step
  transactional SMS already needs via `MSG91_TRANSACTIONAL_TEMPLATE_ID`) — this plan wires the code
  path and gates it the same "log-and-skip if unconfigured" way, but cannot itself complete that
  account-side approval.
- Mobile scope: build out the real profile-editing screen (name/email/phone with OTP re-link),
  porting the web's existing `ProfileForm.tsx` logic to React Native.

**Grounded in current code** (not assumed):
- `AuthService.verifyOtp()`/`loginWithGoogle()` (`apps/bff/src/auth/auth.service.ts`) both use
  Prisma `upsert` — there's currently no signal distinguishing a brand-new signup from a returning
  login.
- `NotificationsService` (`apps/bff/src/notifications/notifications.service.ts`) and its
  `EmailProvider`/`Msg91Provider.sendTransactionalSms` are **already built and working** (used
  today for moderation flag/approve emails+SMS) — this plan extends that existing "best-effort,
  logged-and-skipped-if-unconfigured" infrastructure rather than building parallel plumbing.
- `NotificationsModule` currently `imports: [AuthModule]` (for `Msg91Provider`). If `AuthService`
  needs to call `NotificationsService`, that's a **circular module dependency** unless resolved
  first (see below).
- Web's `ProfileForm.tsx` (`apps/web/src/components/home/ProfileForm.tsx`) already fully
  implements: an email text field (only shown editable when `!profile.email`), a phone OTP-link
  flow (`sendOtpAction` + `linkPhoneAction`, only shown when `!profile.phone`), and already
  computes `canSave = !!currentPhone && !emailMissing` — i.e. **the web app already requires both
  fields filled before any profile save succeeds**. This plan adds the *proactive* nudge on top of
  that existing (reactive, only-seen-if-you-visit-/profile) gate.
- Mobile's `apps/mobile/src/context/HomeSheetsProvider.tsx` is the mobile equivalent of web's
  `AuthGateProvider` (tracks `isLoggedIn`/`accessToken`, renders a persistent toast the same way a
  banner would need to). `apps/mobile/src/lib/bffClient.ts` has no `fetchProfile`/`updateProfile`/
  `linkPhone` functions yet — need to add them, mirroring web's `apps/web/src/lib/bff.ts`.
- **Note for implementation**: `apps/mobile/AGENTS.md` says Expo has changed recently and to read
  the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing mobile code — check
  that before touching `account.tsx`/`HomeSheetsProvider.tsx`, in case any component/API used here
  needs updating for the current Expo version.

## Part A — Welcome message on first sign-in (BFF only)

### 1. Resolve the `AuthModule` ↔ `NotificationsModule` circular dependency first

Currently `NotificationsModule` imports `AuthModule` purely to get `Msg91Provider`. Instead of
`forwardRef()`, cleanly invert the dependency: move `Msg91Provider` out of `AuthModule` and into
`NotificationsModule`.

- Move `apps/bff/src/auth/providers/msg91.provider.ts` → `apps/bff/src/notifications/providers/msg91.provider.ts`.
- `NotificationsModule`: add `Msg91Provider` to its own `providers`/`exports`; drop the
  `imports: [AuthModule]`.
- `AuthModule`: drop `Msg91Provider` from its `providers`/`exports`; add
  `imports: [NotificationsModule]` instead (gets both `Msg91Provider`, for OTP, and
  `NotificationsService`, for the new welcome dispatch).
- Update the one import site: `apps/bff/src/auth/auth.service.ts`'s
  `import { Msg91Provider } from './providers/msg91.provider'` → `'../notifications/providers/msg91.provider'`.

### 2. Detect "first login" — new `welcomedAt` column, not a create-vs-update branch check

Add `welcomedAt DateTime?` to the `User` model (`apps/bff/prisma/schema.prisma`). A new migration:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "welcomedAt" TIMESTAMP(3);
-- Backfill: existing users should NOT suddenly get a "Welcome!" message on their next login —
-- only genuinely new signups from this point on should.
UPDATE "User" SET "welcomedAt" = "createdAt" WHERE "welcomedAt" IS NULL;
```

Checking `welcomedAt === null` on the row returned from `upsert()` works regardless of whether the
upsert's `create` or `update` branch fired — a freshly-created row has no `welcomedAt` (not set in
the `create` data), so it's null exactly once, on the true first login, and never again. No need to
otherwise distinguish create vs. update.

### 3. `NotificationsService.notifyWelcome()`

New method alongside the existing `notifyListingFlagged`/`notifyListingApproved`, using the same
`dispatch`-style fan-out but across three channels instead of two:

```ts
async notifyWelcome(user: { name: string | null; email: string | null; phone: string | null }): Promise<void> {
  const greeting = user.name ? `Hi ${user.name}` : 'Hi';
  const emailBody = `${greeting},\n\nWelcome to Bhavano! ...`;
  const smsBody = `${greeting}, welcome to Bhavano! ...`;
  await Promise.all([
    user.email ? this.emailProvider.send(user.email, 'Welcome to Bhavano!', emailBody) : Promise.resolve(),
    user.phone ? this.msg91.sendTransactionalSms(user.phone, smsBody) : Promise.resolve(),
    user.phone ? this.msg91.sendWhatsapp(user.phone, smsBody) : Promise.resolve(),
  ]);
}
```

### 4. `Msg91Provider.sendWhatsapp()` — new method, mirrors `sendTransactionalSms`'s shape exactly

```ts
/** MSG91 WhatsApp Business API — a distinct product from SMS, requires its own registered
 * WhatsApp sender number + an approved message template (MSG91 dashboard, not something this
 * code can satisfy) before real sends work. Best-effort, same as sendTransactionalSms: logs
 * and skips rather than throwing when unconfigured. Verify the exact endpoint/payload shape
 * against MSG91's current WhatsApp API docs (https://docs.msg91.com/whatsapp) before relying
 * on this in production — MSG91's WhatsApp API surface has changed over time. */
async sendWhatsapp(phone: string, body: string): Promise<void> {
  const authKey = this.config.get<string>('MSG91_AUTH_KEY');
  const integratedNumber = this.config.get<string>('MSG91_WHATSAPP_INTEGRATED_NUMBER');
  const templateName = this.config.get<string>('MSG91_WHATSAPP_TEMPLATE_NAME');
  if (!authKey || !integratedNumber || !templateName) {
    this.logger.warn(`MSG91 WhatsApp not configured — skipping WhatsApp to ${phone}: "${body}"`);
    return;
  }
  try {
    const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: { name: templateName, language: { code: 'en' }, to_and_components: [{ to: [`91${phone}`], components: { body_1: { type: 'text', value: body } } }] },
        },
      }),
    });
    if (!res.ok) this.logger.error(`MSG91 WhatsApp send failed (${res.status}): ${await res.text()}`);
  } catch (error) {
    this.logger.error(`Failed to send WhatsApp to ${phone}: ${error instanceof Error ? error.message : error}`);
  }
}
```

New env vars: `MSG91_WHATSAPP_INTEGRATED_NUMBER`, `MSG91_WHATSAPP_TEMPLATE_NAME` — add blank
placeholders to `apps/bff/.env`, `apps/bff/.env.example`, and `.env.production.example`, matching
how `MSG91_TRANSACTIONAL_TEMPLATE_ID` is already documented there.

### 5. Wire it into `AuthService`

In both `verifyOtp()` and `loginWithGoogle()`, right after `promoteToAdminIfAllowlisted`:

```ts
const isFirstLogin = promoted.welcomedAt === null;
if (isFirstLogin) {
  await this.prisma.user.update({ where: { id: promoted.id }, data: { welcomedAt: new Date() } });
  void this.notificationsService.notifyWelcome(promoted); // fire-and-forget — see below
}
```

**Deliberately not awaited** (`void`, not `await`) — unlike `AdminService`'s existing
`notifyListingFlagged`/`notifyListingApproved` calls (which *are* awaited synchronously), login is
a latency-sensitive path and this fans out to three external network calls. Marking `welcomedAt`
immediately (before the send even starts) avoids a double-send race if two requests for a genuinely
new user land concurrently (e.g. a flaky client retry), accepting the same trade-off the rest of
this codebase already makes for notifications: best-effort, not retried on failure.

`devLogin` (test-only, Playwright) is untouched — it only ever looks up existing seeded users, so
their `welcomedAt` will already be backfilled/non-null; no risk of spamming real numbers during
automated test runs.

### 6. `AuthModule` needs `NotificationsService` injected into `AuthService`'s constructor.

## Part B — Web: profile-completion banner

New component `apps/web/src/components/home/ProfileCompletionBanner.tsx` (client component),
reusing the existing `fetchProfileAction()` (`apps/web/src/app/actions/users.ts` — already returns
`{ requiresLogin: true } | { requiresLogin: false; profile }` and already handles the
`BffAuthError`-on-stale-token case from the earlier session-crash fix).

```tsx
"use client";
export function ProfileCompletionBanner() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);

  useEffect(() => {
    fetchProfileAction().then((result) => setProfile(result.requiresLogin ? null : result.profile));
  }, [pathname]); // refetch on every navigation, so fixing it on /profile then navigating away clears the banner

  if (!profile) return null;
  const missing = [!profile.email && "email", !profile.phone && "phone number"].filter(Boolean);
  if (missing.length === 0) return null;

  return (
    <div className="...">
      Add your {missing.join(" and ")} to your profile so we can keep you updated.{" "}
      <Link href="/profile">Update profile →</Link>
    </div>
  );
}
```

No dismiss button — the ask is explicitly "until the user has filled in this detail," so it should
persist across every page until resolved rather than being permanently dismissible. Mount it in
`apps/web/src/app/layout.tsx` inside `<AuthGateProvider>`, above `{children}`, so it's present on
every route.

## Part C — Mobile: real profile screen + profile-completion banner

### 1. `apps/mobile/src/lib/bffClient.ts` — add three functions mirroring web's `bff.ts`

```ts
export function fetchProfile(accessToken: string): Promise<UserProfileDto> {
  return authedBffFetch(accessToken, "/users/me");
}
export function updateProfile(accessToken: string, input: UpdateProfileInput): Promise<UserProfileDto> {
  return authedBffFetch(accessToken, "/users/me", { method: "PATCH", body: JSON.stringify(input) });
}
export function linkPhone(accessToken: string, phone: string, code: string): Promise<{ success: true }> {
  return authedBffFetch(accessToken, "/auth/otp/link", { method: "POST", body: JSON.stringify({ phone, code }) });
}
```

### 2. `HomeSheetsProvider.tsx` — track `profile` alongside the existing `accessToken`/`isLoggedIn`

Add `profile: UserProfileDto | null` and `refreshProfile: () => Promise<void>` to
`HomeSheetsContextValue`. Fetch profile whenever `accessToken` becomes non-null (on restore from
`SecureStore` on mount, and right after `onLoginSuccess`); expose `refreshProfile` so `account.tsx`
can re-trigger it after a successful save. Render the same non-dismissible banner pattern as web
(gated on `profile && (!profile.email || !profile.phone)`) as a `View` sibling to the existing
toast, so it's visible app-wide.

### 3. Build out `app/(tabs)/account.tsx` into a real profile form

Port `ProfileForm.tsx`'s logic (name field, email field shown editable only when `!profile.email`,
phone shown read-only when set else a `sendOtp`/`linkPhone` two-step flow identical to
`onSendPhoneOtp`/`onVerifyPhoneOtp`) to React Native primitives (`TextInput`/`Pressable`, following
this file's and `HomeSheetsProvider`'s existing styling conventions — `useAppTheme()` colors,
`StyleSheet.create`). Out of scope: city editing (not part of this ask, and mobile's `city` state
in `HomeSheetsProvider` is a browsing-only concern unrelated to the `User.cityId` profile field —
leave that as-is). On successful save, call `refreshProfile()` so the global banner updates
immediately without waiting for a remount.

## Verification

1. `pnpm --filter bff typecheck`, `pnpm --filter web typecheck`, `pnpm --filter mobile typecheck`
   after the module move (circular-dependency resolution) and new Prisma column.
2. Run the new migration; confirm existing seeded users have `welcomedAt` backfilled (non-null) —
   query `SELECT phone, email, "createdAt", "welcomedAt" FROM "User";`.
3. Create a genuinely new user (fresh phone number via `verifyOtp`, or a fresh Google account) and
   confirm: `welcomedAt` was null before, is now set; `notifyWelcome` fires (check BFF logs for the
   email/SMS/WhatsApp best-effort log lines — real delivery depends on MSG91 WhatsApp template
   approval being done separately, outside this codebase's control).
4. Log in a second time with the same user — confirm no second welcome dispatch (BFF logs show no
   repeat `notifyWelcome` call).
5. Web: log in as a phone-only user, confirm the "Add your email..." banner appears on every page;
   fill in email on `/profile`, navigate elsewhere, confirm the banner disappears.
6. Mobile: same check on the Account tab — build/run via Expo, confirm the profile form renders,
   phone OTP-link flow works, and the banner clears after saving.
