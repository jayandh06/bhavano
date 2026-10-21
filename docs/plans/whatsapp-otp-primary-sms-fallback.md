# WhatsApp OTP first, SMS as the fallback

## Why
Later notifications (lead alerts, reminders, welcome) go out on WhatsApp. Sending the login code
there too starts that thread on day one and avoids DLT/operator filtering. SMS stays, because some
numbers have no WhatsApp and WhatsApp can accept a message the user never sees.

## Template
`whatsapp_otp` (Meta AUTHENTICATION, approved): "{{1}} is your verification code. For your
security, do not share this code. Expires in 10 minutes." + Copy code button. The 10 minutes must
match `OTP_TTL_MS` in `apps/bff/src/auth/otp.service.ts`. Created by `whatsapp_create_otp_template.py`.
Sent through MSG91 with `body_1` (the code) and `button_1` (subtype url, the code again).

## Behaviour
- `POST /auth/otp/send` takes an optional `channel` (`whatsapp` | `sms`) and returns the channel used.
- Default: `Msg91Provider.sendWhatsappOtp`; if it is unconfigured, errors or throws, the SAME code goes
  out by SMS (`sendOtp`). `channel: "sms"` goes straight to SMS.
- Kill switch: `OTP_DEFAULT_CHANNEL=sms` stops the WhatsApp attempt for everyone.
- Env: `MSG91_WHATSAPP_OTP_TEMPLATE_NAME=whatsapp_otp`, `MSG91_WHATSAPP_OTP_NAMESPACE` (falls back to
  `MSG91_WHATSAPP_NAMESPACE`), shared `MSG91_WHATSAPP_INTEGRATED_NUMBER`.
- Web and mobile login: phone step says the code comes on WhatsApp; OTP step says where to look
  ("open WhatsApp, tap Copy code"); after 20 s "Send the code by SMS instead" appears (a fresh code,
  the old challenge is superseded). If the server fell back, the screen says SMS.
- Test account (`TEST_OTP_PHONE`) still sends nothing.

## Not done
- Explicit WhatsApp consent line / record for notifications (an OTP is not marketing opt-in).
- Delivery-receipt-driven automatic SMS (webhook) and per-channel analytics.
- Android zero-tap / one-tap autofill (needs package + signature hash); iOS has Copy code only.
- Link-phone, profile verify and delete-account OTPs share the same endpoint, so they also go by
  WhatsApp first; only their wording ("on WhatsApp (or by SMS)") was touched on web.
- Mobile type-check could not be run (tsc crashes in this repo); backend and web check clean.
