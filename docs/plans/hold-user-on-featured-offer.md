# Plan: keep the seller on the Featured offer until they answer

Status: proposal, 2026-10-23. Nothing built. Builds on [`post-first-featured-upsell.md`](post-first-featured-upsell.md) (the offer screen
shown right after "Post ad", with **No thanks, continue** and the Featured price picker).

## The question
Can we stop a seller leaving the Featured offer screen until they either pay for Featured or tap **No thanks**, on every device?

## Short answer
Only partly, and a full lock is not worth it. We can control navigation **inside** our website and app (menus, links, the back
button, tabs). We cannot stop someone closing the browser tab, swiping the app away, locking the phone, or following a notification;
a web page can at most show the browser's own "Leave site?" box, and a store app that traps the back button risks bad reviews.
Also, the ad is **already live** (or scheduled) when the offer appears, so leaving costs the seller nothing and costs us only the chance
to sell Featured.

## What happens today (production, 2026-10-20 to 2026-10-23)
42 sessions saw the offer screen. 14 tapped **No thanks**; 5 tapped Pay (4 paid or activated, 2 cancelled the payment window); 2 only
picked a duration. So **at least 21 of 42, about half or more, left without any answer** (closed the tab, used the menu, switched
tab, pressed back). The sample is small (three days) and may include staff test sessions. Paid conversion is already about 10% of
those who saw the screen.

Where they can leave today:
- **Web:** the site header and footer are still on the page (logo, city picker, menus, login), and the browser back button leaves
  `/post`. The Review step already guards back (`PostAdWizard.tsx` pushes a history entry and handles `popstate`); the offer step does not.
- **Mobile app:** `Post` is one of the bottom tabs (`app/(tabs)/post.tsx`), so the tab bar stays visible and any tab, plus the
  Android back button and the iOS swipe-back, take the user away. Nothing uses `BackHandler` or `gestureEnabled` today.

## What we can and cannot control
| Exit | Web | Android app | iOS app |
|---|---|---|---|
| Menus, links, tabs inside our UI | yes (hide or disable on this step) | yes (hide the tab bar on this step) | yes |
| Browser/system back | yes (history entry + `popstate`, as Review does) | yes (`BackHandler`) | yes (`gestureEnabled: false`) |
| Closing the tab / swiping the app away / home button | **no** (only a generic browser "Leave site?" box via `beforeunload`) | **no** | **no** |
| Notification or deep link opening another screen | n/a | partly (only if we choose to intercept) | partly |

## Options
1. **Guard the in-app exits, never trap (recommended).** On the offer step only: hide the site header links / bottom tab bar, intercept
   back, and show one clear prompt: "Skip Featured for now?" with **Yes, skip** (same as No thanks) and **Stay**. The user can still
   close the page or app. No browser "Leave site?" box.
2. **Option 1 plus the browser's "Leave site?" box on web** (`beforeunload`). Cannot be worded by us, is skipped by some browsers
   unless the user has interacted, and annoys people who simply want to finish. Add only if option 1 is not enough.
3. **A hard lock** (no way out except Pay or No thanks, including the app's back button and swipe). Not recommended: it cannot be
   completed on tab close or app swipe-away anyway, it traps people with a payment error or no network, it hurts store ratings and
   trust, and sellers who were going to say no get annoyed at the moment we want them to post a second ad.

## Recommended build (option 1)
**Web (`PostAdWizard.tsx`, offer step)**
- Hide the page's header navigation and footer while `step === "offer"` (render a minimal header with the logo only, not a link).
- On entering the step, push a history entry (as Review does) and on `popstate` show the "Skip Featured for now?" dialog instead of leaving.
- Keep **No thanks, continue** always visible and working even if the price fails to load or the payment script errors.
- Cancelled payment already stays on the screen with a retry message (2026-10-21), keep that.

**Mobile (`PostAdWizard.tsx`, `app/(tabs)/post.tsx` and the tab layout)**
- While the step is `offer`, hide the tab bar for this screen and set `gestureEnabled: false` / no header back.
- Intercept the Android hardware back with `BackHandler` and show the same dialog.
- iOS shows the App Store card path (Apple 3.1.1); the dialog and **No thanks** behave the same. Read the Expo SDK 57 docs for the
  exact navigation options before coding (the repo's `apps/mobile/AGENTS.md` asks for it).

**Both**
- Record `post_offer_leave_prompt` (shown), `post_offer_leave_confirmed` and `post_offer_leave_stay` through the existing
  `/post/action?screen=offer&event=` trail, plus `post_offer_abandoned` on `pagehide` / app background without an answer, so the
  "left without answering" share is measured exactly instead of inferred.
- Put it behind an admin flag (the Boost pricing settings already hold such switches) so it can be turned off in minutes.

## How we will know it worked
Compare the week before and after, ideally with the flag on for half the traffic: share who answer (No thanks or Pay) / share who
leave without answering, paid conversions, the Featured payment error and cancel rate, support tickets, and app-store reviews that
mention being stuck. Expect a modest lift at best: the people who leave are mostly not buyers, so the gain is bounded by roughly
10% of the extra answerers.

## Risks and edge cases
- A seller whose payment or price load fails must still be able to leave: **No thanks** and the dialog's **Yes, skip** never depend on the network.
- Accessibility: focus moves into the dialog, Escape closes it, back is announced; no colour-only cues.
- The posted-confirmation email / WhatsApp is released when the live screen is reached or after the fallback delay
  (`Settings → Posted confirmation`); an abandoned offer still gets it after the delay.
- If "Don't show a free ad until the wait has passed" is on, the ad is scheduled; the offer text must say so (already handled on the confirmation screen).
- Older app builds will not have the guard until they update; the store build 1.3.0 carries it.

## Decisions for you
1. Option 1 only, or option 1 plus the browser box on web?
2. Show the "Skip Featured for now?" dialog, or let back simply do nothing on the offer step? (Doing nothing is the harsher choice.)
3. Behind an admin flag with a 50/50 split first, or on for everyone?
