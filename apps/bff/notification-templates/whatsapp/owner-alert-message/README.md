# `owner_alert_message` — submit to MSG91 / Meta (Utility)

**Not yet submitted.** Reference for the wording to submit, and the order of the values `Msg91Provider.sendOwnerAlert` sends. Editing this file changes nothing; the approved copy lives on the MSG91 account.

Category: **Utility** (a transactional notice about the recipient's own ad). Language: English.

```
You have a new message on Bhavano from {{1}} about your ad "{{2}}". You can read it in your messages.
```

| Slot | Value | Example |
| --- | --- | --- |
| `body_1` | the sender's name ("Someone" if unknown) | `Riya` |
| `body_2` | the ad's title | `2 BHK Apartment in Whitefield` |
| `button_1` (URL, dynamic suffix) | the conversation id | `cm3x...` |

Button: **View message** → `https://www.bhavano.com/messages/{{1}}`

Env (prod `.env`): `MSG91_WHATSAPP_OWNER_MESSAGE_TEMPLATE_NAME` (the approved name), optional `MSG91_WHATSAPP_OWNER_MESSAGE_NAMESPACE`. Until the name is set the send is skipped and the next channel is tried.
After approval, check the template's MSG91 "Code" snippet against `sendOwnerAlert` before enabling: MSG91 checks the number of values, never their meaning.

**Wording note (Utility vs Marketing):** Meta classifies a message as Marketing when it pushes the reader to act ("reply now", "while they are still looking", "message them"). Keep these three to a plain statement of what happened on the owner's own ad plus where to see it. The first draft of all three had such a push and the interest one was classified Marketing.
