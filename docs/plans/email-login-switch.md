# Email login switch (2026-10-28)

## Why
Suspicion that people create throwaway email accounts and sign in with Google to collect owners' contact details (each new account gets free contact reveals). Data check on prod, last 30 days, real users:

| Signed up with | Users | Posted an ad | Revealed a contact | Messaged |
| --- | --- | --- | --- | --- |
| Phone only | 533 | 345 | 18 (3%) | 19 |
| Email only (Google / Apple, no phone) | 150 | 3 | 38 (25%) | 5 |
| Phone and email | 126 | 113 | 5 | 8 |

The ten email-only accounts with the most reveals each used exactly their full free allowance (5) with no ads and no messages. That pattern fits harvesting; it is not proof (some may be genuine seekers). Email-only sign-ups run at about 20 to 50 a week (`google_no_phone` in the weekly cut).

## What it does
A single setting, **Admin -> Settings -> Login methods** (`LoginSetting`, id `default`), with three modes (`@bhavano/types/loginSettings`):
- **all** (default, no change in behaviour): Google / Apple work as before.
- **existing_only**: someone who already has an account can still sign in with Google / Apple (including taking over a phone account whose email is verified); a **new** account cannot be created that way. Stops new throwaway accounts without locking out real returning users.
- **off**: Google / Apple closed to everyone. Buttons hidden. People who only ever signed in with email cannot log in until it is reopened.

Phone OTP is never affected. **Staff always get through** (an existing admin, or an address on `ADMIN_EMAILS`), because the admin app signs in with Google and closing it for everyone would lock the team out of the screen that reopens it.

## How
- Enforced in `AuthService.loginWithGoogle` / `loginWithApple` (`assertEmailLoginOpen`), before any account is created or touched. Refusal is a 403 with `code: EMAIL_LOGIN_DISABLED` and the message "Please sign in with your mobile number."
- A read failure of the setting falls back to **all** (a settings fault must not lock people out), same stance as the other settings.
- Public `GET /auth/login-methods` returns the mode; the website login dialog, Google One Tap (only runs on **all**) and the app login sheet use it to hide Google / Apple, and show "Google sign-in is for existing accounts. New here? Continue with your mobile number." on existing_only. The server enforces the setting whatever the screens show; the screens only decide what is offered. The website looks it up only when the login dialog opens.
- Admin `GET` / `PATCH /admin/login-settings`.

## Cautions
- **Existing email-only users** (about 150 from the last month, more before) cannot log back in under **off**, and have no phone to fall back on. Under **existing_only** they keep access. Prefer existing_only first.
- **iOS App Review:** the iOS app is in review. If the reviewers' test account signs in with Google / Apple, switching to **off** would break their review. Keep **all** or **existing_only** until it is through, or confirm the review account uses a phone OTP.
- Spammers can still sign up with a phone number. The stronger fix for harvesting itself is to require a verified phone to reveal a contact; that is separate and not done here.
- The mobile app needs a store build / OTA to pick up the hiding of the buttons; the server-side check works for every app version immediately.

## Mobile app (2026-10-28)
- **Enforcement already covers every app version.** The check is on the server, so an app build that predates this still cannot sign in with Google / Apple (or create a new account that way) when the switch is closed to that account. It just still *shows* the button, and the refusal appears as the raw 403 text.
- **New builds** read `GET /auth/login-methods` (cached a minute) and hide the Google / Apple buttons, show the "existing accounts only" note, and turn a refused attempt into "Please sign in with your mobile number." and re-read the setting.
- All of this is JavaScript only (no new native module), so it can ship as an EAS Update on the current runtime version; no store build is needed unless the runtime version is bumped.
