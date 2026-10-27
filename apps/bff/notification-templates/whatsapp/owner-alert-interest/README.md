# `owner_alert_interest` — submit to MSG91 / Meta (Utility)

**Not yet submitted.** See `owner-alert-message/README.md` for how this is used.

```
Update on your ad "{{2}}" on Bhavano: {{1}} viewed your ad and shared their interest. You can see this activity in My listings.
```

| Slot | Value | Example |
| --- | --- | --- |
| `body_1` | the interested person's name ("Someone" if unknown) | `Riya` |
| `body_2` | the ad's title | `2 BHK Apartment in Whitefield` |
| `button_1` (URL, dynamic suffix) | `my-listings` | `my-listings` |

Button: **Open** → `https://www.bhavano.com/{{1}}`

Env: `MSG91_WHATSAPP_OWNER_INTEREST_TEMPLATE_NAME`, optional `MSG91_WHATSAPP_OWNER_INTEREST_NAMESPACE`.
