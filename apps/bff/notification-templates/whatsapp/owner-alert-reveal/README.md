# `owner_alert_reveal` — submit to MSG91 / Meta (Utility)

**Not yet submitted.** See `owner-alert-message/README.md` for how this is used. Anonymous on purpose: the app does not tell the owner who looked.

```
Someone viewed the contact number on your ad "{{1}}" on Bhavano. You can see this activity in My listings.
```

| Slot | Value | Example |
| --- | --- | --- |
| `body_1` | the ad's title | `2 BHK Apartment in Whitefield` |
| `button_1` (URL, dynamic suffix) | `my-listings` | `my-listings` |

Button: **Open my ad** → `https://www.bhavano.com/{{1}}`

Env: `MSG91_WHATSAPP_OWNER_REVEAL_TEMPLATE_NAME`, optional `MSG91_WHATSAPP_OWNER_REVEAL_NAMESPACE`.
