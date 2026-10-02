# Bhavano Referral Program: Requirements

Oct 2, 2026 · Jayandhan R

## Overview

Bhavano.com users who have recently posted an ad can share it with other owners, agents, brokers and friends, and earn a free boost on one of their ads when someone they referred posts an ad of their own.

The referral code is the referrer's user ID. Every shared listing link carries that code, so Bhavano can attribute new signups and new ads back to the person who shared.

The program uses the channel real estate agents already use (WhatsApp groups) to bring in new posters without paid acquisition.

## Goals and success metrics

The program succeeds if shared listings bring in new posters at a lower cost than other acquisition channels.

| Metric | Definition | Target (first 90 days) |
| --- | --- | --- |
| Share rate | Posters who tap Share after publishing an ad, as % of ads published | To be set after baseline |
| Click-to-signup | New signups from referral links, as % of referral link clicks | To be set after baseline |
| Referred ad rate | Referred signups who publish an approved ad within 7 days | To be set after baseline |
| Boosts granted | Free boosts granted per month | Capped by budget (see Open questions) |
| Fraud rate | Rewards reversed or blocked, as % of rewards triggered | Below 5% |

## Scope

Version 1 covers sharing a posted ad, tracking referrals by user ID, and granting a free boost to the referrer.

**In scope**

- Share screen and share button shown after an ad is published
- Referral link carrying the referrer's user ID
- Attribution of new signups and their first approved ad to the referrer
- Free boost credit for the referrer, redeemable on any of their ads
- Welcome reward for the referred user (optional, see Open questions)
- Referral dashboard under My Account
- Anti-abuse checks and admin view of referrals

**Out of scope for v1**

- Cash or wallet payouts
- Multi-level referrals (referrer of a referrer)
- Referral codes typed manually at signup, other than through the link
- Share channels other than WhatsApp, copy link and the device share sheet

## User stories

| ID | As a... | I want to... | So that... |
| --- | --- | --- | --- |
| US-1 | Poster (owner, agent or broker) | Share my live ad on WhatsApp in one tap | Other agents and friends see it without me copying links |
| US-2 | Poster | Have my user ID attached to the link automatically | I get credit when someone joins through it |
| US-3 | Poster | Get a free boost when a person I referred posts an ad | My own ad gets more visibility at no cost |
| US-4 | Poster | See how many people clicked, joined and posted | I know whether sharing is working |
| US-5 | New user | Land on the shared listing and sign up easily | I can post my own ad quickly |
| US-6 | New user | Get a small reward on my first ad | I have a reason to post now |
| US-7 | Bhavano admin | See referrals, rewards and flagged cases | I can stop abuse and measure cost |

## How it works

A poster shares a live ad, a new person joins through that share and posts their first ad, and once that ad is approved the poster earns a free boost.

1. The poster publishes an ad and it goes live.
2. Bhavano offers one-tap sharing, WhatsApp first, with the ad's title, locality, price and photo already filled in.
3. The shared link carries the poster's user ID as the referral code.
4. A new person opens the link, sees the ad, signs up and posts their own ad.
5. When moderation approves that ad, the poster gets a free boost credit and the new user gets a welcome reward, if enabled.
6. The poster applies the credit to any of their own ads.

## Functional requirements

### Referral code

- The code is the user's ID. Nothing extra to generate or remember.
- Use a public ID that cannot be guessed or used to count Bhavano's users, not a plain running number.
- The code is shown on the Share screen and the Referrals page, with a copy button.

### Sharing

- After an ad goes live, show a Share screen with WhatsApp, Copy link and the phone's own share options.
- The pre-filled message includes a short line inviting the reader to post their own ad on Bhavano.
- Sharing is also available at any time from My Ads, not only right after posting.

### Attribution

- A referral is credited when someone opens a shared link and signs up within 30 days.
- If they open several links before signing up, the latest one wins. Once they have signed up, their referrer is fixed.
- Each referral moves through: clicked, signed up, ad posted, ad approved, rewarded.

### Rewards

- The referrer gets 1 free boost per successful referral (default 3 days). Admin can change this.
- The new user optionally gets a welcome reward on their first ad, such as 1 day featured.
- Bonus tiers: 3 successful referrals in a month earn an extra boost, 5 earn a Top Agent badge on the profile.
- Credits expire after 60 days if unused. Each referred person can earn a reward only once.

### Using a free boost

- When boosting an ad, the user sees their balance and a Use free boost option.
- A credit works on any of the user's own ads. It cannot be transferred or cashed out.
- The credit closest to expiring is used first.

### Referrals page

- Shows the user's code, a Share button, boost balance and the next expiry date.
- Shows a simple funnel: clicks, signups, ads posted, boosts earned.
- Lists referred people with masked names, never full phone numbers, with their status.

## Business rules and anti-abuse

Rewards are paid only for a new, phone-verified user whose first ad passes moderation, and every rule below is enforced on the server.

| ID | Rule |
| --- | --- |
| BR-1 | The referred user must be new: no existing account with the same phone number. |
| BR-2 | A phone number can be referred only once, ever, even if the account is deleted and recreated. |
| BR-3 | Self-referral is blocked: referrer and referred cannot share the same phone, device ID or payment instrument. Matching IP alone flags the case for review but does not block it (shared Wi-Fi in offices and PGs is common). |
| BR-4 | The reward fires only when the referred user's first ad is approved by moderation. Rejected, duplicate or removed ads do not count. |
| BR-5 | If the referred user's ad is removed for policy violations within 14 days of approval, the referrer's unused credit from that referral is revoked. |
| BR-6 | Cap: a referrer can earn at most 5 free boosts per calendar month (configurable). Further referrals still count on the dashboard but grant no credit. |
| BR-7 | Only users with at least one approved ad can refer. This keeps the program for real posters. |
| BR-8 | Referral credits have no cash value, cannot be sold or transferred, and expire after 60 days. |
| BR-9 | Admins can freeze a user's referral rewards and reverse a referral from the admin panel. |
| BR-10 | Shared links must not expose personal data. Only the user ID identifies the referrer. |

## Notifications and UI touchpoints

The share prompt appears at the moment of highest intent, right after an ad goes live, and the reward is confirmed immediately by WhatsApp or SMS.

| Touchpoint | Trigger | Content |
| --- | --- | --- |
| Share screen | Ad approved and live | Share on WhatsApp, Copy link, and one line: Share your ad, and get a free boost when a friend posts. |
| Ad live message (WhatsApp or SMS) | Ad approved | Ad is live, with the share link included. |
| My Ads banner | Any visit with at least one live ad | Share your ad and earn free boosts, with the current balance. |
| Referral signup alert | Referred user signs up | A friend joined through your link. They need to post an ad for you to earn a boost. |
| Reward alert | Reward granted | You earned a free boost. Use it on any of your ads. Valid until the expiry date. |
| Expiry reminder | 7 days before a credit expires | Your free boost expires on the date. Use it now. |
| Landing page for referred visitor | Link opened with ref | Shows the shared listing, plus a Post your ad free banner with the welcome reward, if enabled. |

## Visibility and promotion to posters

The offer must reach posters at the moments they are most motivated, and the reward must feel concrete, not abstract.

### When to show it

- **Right after the ad goes live.** The Share screen is the success page itself, not a dismissible pop-up. It leads with the reward ("Your ad is live. Share it and earn a free 3-day boost."), the WhatsApp button is the largest element, and Skip is small text.
- **In the "ad is live" message.** The WhatsApp or SMS message carries the share link and one line about the free boost, so posters who never reopen the app still see it.
- **On the Boost screen.** Offer "Don't want to pay? Earn a free boost by inviting a friend."
- **When an ad is about to expire or gets few views.** Prompt: "Get more views, share it with agents you know."
- **When a poster reposts or renews an ad.**

### Make the reward visible

- Show a boost balance chip in the app header once the poster has a credit (for example, "1 free boost").
- Show progress on My Ads (for example, "Invite 1 more friend to earn a free boost. 2 of 3 toward Top Agent.").
- Show a small expiry countdown on unused credits (for example, "expires in 12 days").

### Make sharing effortless

- Sharing takes one tap.
- The shared WhatsApp preview shows the photo, price and locality, so it looks worth forwarding.

### Social proof

- Show small proof lines such as "Ramesh earned 3 free boosts this month".
- Show the Top Agent badge on poster profiles.

### Avoid overdoing it

- Show the full-screen prompt after the poster's first ad, then only every few ads. In between, use a small banner.
- Once a poster has shared, replace the prompt with their progress instead of asking again.

## Other requirements

The referral program must never get in the way of posting an ad.

- If anything in the referral flow fails, signup and ad posting still work.
- A reward is given at most once per referred person, even if something is processed twice.
- Referred people's personal details stay private. The referrer sees only masked names.
- Every reward, use, expiry and reversal is recorded so admin can review it later.
- Boost length, monthly cap, bonus tiers and expiry are settings admin can change without a new release.
- Track the metrics listed under Goals, so the program can be judged on numbers.

## Rollout, acceptance criteria and open questions

Launch to all cities at once, then watch the numbers and adjust the settings.

**Rollout**

1. Build and test internally with test accounts, including every abuse case in the business rules.
2. Launch in all cities and announce on WhatsApp groups and the site.
3. Review share rate, click-to-signup, referred ad rate and fraud rate weekly for the first 4 weeks. Adjust boost length and caps through admin settings.

**Acceptance criteria**

- [ ] A poster with a live ad sees the Share screen and can share on WhatsApp in one tap, with a link containing their user ID.
- [ ] A new user who signs up through the link and gets their first ad approved triggers exactly one boost credit for the referrer.
- [ ] The same phone number cannot be referred twice, and self-referral is blocked.
- [ ] Credits appear in the referrer's balance, can be used on any of their ads, and expire after 60 days.
- [ ] The dashboard counts clicks, signups, ads posted and boosts earned correctly.
- [ ] Rejecting or removing the referred ad within 14 days revokes the unused credit.
- [ ] Admin can view, freeze and reverse referrals.
- [ ] A referral service outage does not block signup or posting.

**Open questions**

- [ ] Is the user ID in the database sequential? If so, which public, non-sequential ID should serve as the code?
- [ ] What does one boost cost Bhavano in practice (paid feature, or higher placement in the feed)? This sets the monthly cap.
- [ ] Should the referred user also get a welcome reward, and how large?
- [ ] Are most posters on the app or the website? This decides where the share button gets the most space.
- [ ] Should a referral count if the referred user was already a visitor but never signed up? (Assumed yes, within 30 days.)
