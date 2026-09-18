# `ad_boost_instant_alert` (MSG91)

**Reference only — editing this file changes nothing.** This template is approved on the MSG91
account, and its wording lives there. This copy exists so the variable *order* is written down
somewhere a reader of the code can find, because the payload sends the four body values
positionally and unnamed: get the order wrong and the price goes where the name should, with no
error from anyone.

The order `Msg91Provider.sendBoostPromotion` sends:

| Slot | Value | Example |
| --- | --- | --- |
| `body_1` | owner's first name (or "there") | `Ravi` |
| `body_2` | the ad's title | `2 BHK for rent in Koramangala` |
| `body_3` | Boost price, discount already applied | `100` |
| `body_4` | Boost + Instant Alerts price, discount applied | `112` |

Two dynamic URL buttons, each carrying only the **suffix** appended to the base URL baked into the
template. This template's base, confirmed from a real send on 2026-09-18, is:

```
https://www.bhavano.com/checkout?plan=boost&ad=
```

| Button | Suffix sent | Resulting URL | Lands on |
| --- | --- | --- | --- |
| `button_1` | `<id>` | `/checkout?plan=boost&ad=<id>` | `/my-listings?openBoost=<id>` |
| `button_2` | `<id>&withAlerts=1` | `/checkout?plan=boost&ad=<id>&withAlerts=1` | the same, Instant Alerts ticked |

`/checkout` is a real route (`apps/web/src/app/checkout/page.tsx`) that exists purely to forward
these to the screen the email's buttons open — a template's button base cannot be changed without a
new template and a fresh Meta approval, so the base was made true instead of fought. It also reads
the *older* suffix form (`my-listings?openBoost=<id>`) that already-delivered messages carry, so
those buttons keep working.

If this template is ever recreated with a bare-domain base, the suffixes here go back to carrying
the whole path and `/checkout` can be deleted.

Unlike the email, there is nowhere here for the discount percentage or the offer's end date: four
slots, and the name, title and two prices use all of them. A WhatsApp recipient gets the offer
price without the explanation around it.
