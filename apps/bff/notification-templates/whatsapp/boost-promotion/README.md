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

Two dynamic URL buttons, each carrying only the **suffix** appended to the base URL the template
itself was created with:

| Button | Suffix sent | Opens |
| --- | --- | --- |
| `button_1` | `my-listings?openBoost=<id>` | Boost for that ad |
| `button_2` | `my-listings?openBoost=<id>&withAlerts=1` | the same screen, Instant Alerts ticked |

Those suffixes assume a **bare-domain base** (`https://www.bhavano.com/`), which is what
`claim_listing` turned out to have. If this template was created with a different base, both
buttons land somewhere wrong while the message itself looks perfect — send one to your own number
and open both before trusting it.

Unlike the email, there is nowhere here for the discount percentage or the offer's end date: four
slots, and the name, title and two prices use all of them. A WhatsApp recipient gets the offer
price without the explanation around it.
