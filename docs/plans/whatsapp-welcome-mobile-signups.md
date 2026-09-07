# WhatsApp welcome (via MSG91) for first-time mobile signups

## Context

A first-login welcome notification already exists (`AuthService.welcomeIfFirstLogin` →
`NotificationsService.notifyWelcome`) — it fires for any first-ever signup regardless of client,
preferring email and falling back to WhatsApp **via Meta's Cloud API** (`WhatsappProvider`). Since
almost every real signup here is phone-only (no email captured), that Meta WhatsApp fallback is
already the dominant real-world path today.

This request is specifically: route the welcome WhatsApp send through **MSG91** instead, but only
for signups that happen through the **mobile app**, and (confirmed) replace the existing
email/Meta-WhatsApp dispatch for that case rather than sending both. `Msg91Provider` currently
only does SMS (OTP + transactional) — no WhatsApp capability exists there yet, so this is new
provider code, not a config flip. Web signups are untouched.

**Scope (confirmed)**: "first-time mobile login" = a brand-new account created through the mobile
app — the same `welcomedAt`-gated "first login ever" concept that already exists, just branching
on which client the signup came through. An existing user's first time opening the mobile app
does **not** trigger this.

## Manual prerequisite (blocks real sends, not the code)

A WhatsApp Business template needs to be created and approved in the MSG91 dashboard before any
message can actually go out — same class of external, human-only step as this session's earlier
Google OAuth scope grant. The code below is written and buildable regardless; `sendWhatsappTemplate`
follows this repo's established pattern (`Msg91Provider.sendTransactionalSms`) of logging and
returning rather than throwing when its template isn't configured yet, so it degrades safely
until that template exists.

## 1. `Msg91Provider` — new `sendWhatsappTemplate()`

New method in `apps/bff/src/notifications/providers/msg91.provider.ts`, same `authkey`/fetch shape
as `sendOtp`/`sendTransactionalSms`, targeting the endpoint and request body confirmed via MSG91's
docs this session:

```
POST https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/
Headers: authkey: <MSG91_AUTH_KEY>, Content-Type: application/json
{
  "integrated_number": "<MSG91_WHATSAPP_INTEGRATED_NUMBER>",
  "content_type": "template",
  "payload": {
    "messaging_product": "whatsapp",
    "type": "template",
    "template": {
      "name": "<MSG91_WHATSAPP_TEMPLATE_NAME>",
      "language": { "code": "en", "policy": "deterministic" },
            "to_and_components": [{ "to": ["91<phone>"], "components": { "body_1": { "type": "text", "value": "<name>" } } }]
    }
  }
}
```

Signature: `async sendWhatsappTemplate(phone: string, name: string): Promise<boolean>` — returns
`false` (logged, not thrown) when `MSG91_AUTH_KEY`/`MSG91_WHATSAPP_INTEGRATED_NUMBER`/
`MSG91_WHATSAPP_TEMPLATE_NAME` aren't configured, or on a non-OK response — mirrors
`sendTransactionalSms`'s best-effort style exactly (this is a side effect of login, not the login
itself). Body param naming (`body_1` vs the template's actual placeholder name) will need
confirming against whatever the approved template actually declares once it exists — flagged here
since MSG91's docs didn't give a definitive answer this session.

## 2. `NotificationsService` — new `notifyMobileWelcome()`

Inject `Msg91Provider` into the existing constructor (already provided/exported by
`NotificationsModule`, which `AuthModule` already imports — no new module wiring needed). New
method, WhatsApp-only (no email branch, per the "replace" decision):

```ts
async notifyMobileWelcome(user: { name: string | null; phone: string }): Promise<'whatsapp' | null> {
  const sent = await this.msg91.sendWhatsappTemplate(user.phone, user.name ?? 'there');
  return sent ? 'whatsapp' : null;
}
```

## 3. Thread a `client` flag from request to `welcomeIfFirstLogin`

- `apps/bff/src/auth/dto/verify-otp.dto.ts` / `google-login.dto.ts`: add
  `client?: 'web' | 'mobile'` (`@IsOptional() @IsIn(['web', 'mobile'])`).
- `apps/bff/src/auth/auth.controller.ts`: pass `dto.client` as a new argument to
  `authService.verifyOtp`/`loginWithGoogle` (separate from the `VisitContext` object — `client`
  isn't ad/UTM attribution, it's which app the signup came through).
- `apps/bff/src/auth/auth.service.ts`: `verifyOtp`/`loginWithGoogle` gain a `client?: 'web' |
  'mobile'` parameter, passed through to `welcomeIfFirstLogin(user, client)`.
- `welcomeIfFirstLogin` (lines 242-254 today): branch on `client` *after* the existing
  `welcomedAt` guard/update, keeping the shared idempotency logic and only the dispatch call
  itself different:
  ```ts
  private async welcomeIfFirstLogin(user: User, client?: 'web' | 'mobile'): Promise<void> {
    if (user.welcomedAt) return;
    await this.prisma.user.update({ where: { id: user.id }, data: { welcomedAt: new Date() } });
    const send = client === 'mobile'
      ? this.notificationsService.notifyMobileWelcome(user)
      : this.notificationsService.notifyWelcome(user);
    void send.then((channel) => {
      if (!channel) return;
      return this.prisma.userNotificationLog.create({ data: { userId: user.id, kind: 'welcome', channel } });
    });
  }
  ```

## 4. Mobile app sends the flag

`apps/mobile/src/lib/bffClient.ts`'s `verifyOtp`/`loginWithGoogle` (lines ~240-250 today): add
`client: "mobile"` to the request bodies. Web's `apps/web/src/lib/bff.ts` is untouched — it never
sends `client`, so `dto.client` is `undefined` there and the existing email/Meta-WhatsApp path
keeps firing exactly as today.

## 5. Config

`MSG91_WHATSAPP_INTEGRATED_NUMBER` and `MSG91_WHATSAPP_TEMPLATE_NAME` (reuses existing
`MSG91_AUTH_KEY`), read via `ConfigService` same as the rest of `Msg91Provider`. **These two were
already scaffolded in `.env.production.example` back on 2026-07-22** — this plan's naming matches
that pre-existing scaffolding rather than inventing new names; no `namespace` var was ever
scaffolded there either, so the provider omits it (see the provider's own doc comment for why
that's a reasonable bet rather than a gap). Added to `apps/bff/.env` (local, template name filled
in as `bhavano_welcome_2`) and `docker-compose.prod.yml`'s `bff` service. Production's real `.env`
already has both keys present (from the same July scaffolding) but blank — confirmed via SSH.

## Verification

1. `pnpm --filter bff typecheck` / `build`, `pnpm --filter mobile typecheck` (or repo-equivalent)
   pass.
2. With the template vars left unset, confirm a mobile first-signup logs "MSG91 WhatsApp not
   configured — skipping" (matching `sendTransactionalSms`'s existing unconfigured-path log
   style) rather than throwing or silently doing nothing unexplained.
3. Once you've created and gotten approval for the MSG91 WhatsApp template and filled in the env
   vars: a mobile first-time signup should produce a real WhatsApp message from the MSG91 number,
   and a web first-time signup should be completely unaffected (still email if present, else Meta
   WhatsApp) — test both to confirm the branch is actually client-scoped, not global.
4. Confirm `UserNotificationLog` gets a `kind: 'welcome', channel: 'whatsapp'` row for a
   successful mobile send, same as the existing web path already produces.
