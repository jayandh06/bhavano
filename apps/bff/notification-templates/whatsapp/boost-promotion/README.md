# `ad_boost_instant_alert_1` (MSG91)

**Reference only — editing this file changes nothing.** The template is approved on the MSG91
account and its wording lives there. This file exists so the variable *order* is written down
somewhere a reader of the code can find, because the payload sends four body values positionally
and unnamed: MSG91 validates that four arrived, never what they mean, so a wrong order sends a
perfectly successful message that reads as nonsense. It has already happened once — prices went
into the two slots that belong to the locality and the offer's end date.

The order `Msg91Provider.sendBoostPromotion` sends:

| Slot | Value | Example |
| --- | --- | --- |
| `body_1` | owner's name (or "there") | `Ravi` |
| `body_2` | the ad's title | `4 BHK` |
| `body_3` | the ad's locality, as "area, city" | `Raikhad, Ahmedabad` |
| `body_4` | the date the offer ends, IST | `30 September` |

**The prices are part of the approved copy's own fixed text, not variables.** Two consequences: the
figures in the message cannot follow the admin-editable price settings the email's do, and the
WhatsApp half is only sendable while an offer is actually running — with no offer there is no end
date for `body_4`, and an empty parameter is an error rather than a gap in a sentence. The email
has a separate no-offer wording for that case; WhatsApp waits for the next offer.

`namespace` is **null** for this template (its dashboard snippet says so), unlike every other MSG91
template here. It is sent as null rather than treated as missing configuration.

Two dynamic URL buttons, each carrying only the **suffix** appended to the base URL baked into the
template. This template was recreated specifically so that base resolves the real page directly:

| Button | Suffix sent | Opens |
| --- | --- | --- |
| `button_1` | `my-listings?openBoost=<id>` | Boost for that ad |
| `button_2` | `my-listings?openBoost=<id>&withAlerts=1` | the same screen, Instant Alerts ticked |

The predecessor (`ad_boost_instant_alert`) had the base `https://www.bhavano.com/checkout?plan=boost&ad=`,
which is why `apps/web/src/app/checkout/page.tsx` exists — messages already delivered still carry
those buttons, so that route stays until they have aged out of people's chat histories.
