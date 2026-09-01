# Notification templates

Plain text, one file per field, one folder per notification. Edit the wording here directly — no
TypeScript. Whether that edit takes effect immediately or needs a separate approval step depends
entirely on which of the two folders below it's in — read that part before editing a WhatsApp one
expecting the same immediacy as email.

```
email/welcome/            the first-login welcome email
email/listing-posted/     the "your ad is live" email
whatsapp/welcome/         the approved WhatsApp welcome template's wording
whatsapp/listing-posted/  the approved WhatsApp "ad is live" template's wording
```

## `email/` — takes effect on the next send, no rebuild or restart

`NotificationsService` reads these files itself, at send time, via `templateLoader.ts`. On the
live server this folder is bind-mounted from the host (see `docker-compose.prod.yml`), so editing
a file directly on `~/bhavano/apps/bff/notification-templates/...` changes the very next email
sent. Editing it here in git and redeploying works too, for a change you want tracked in history;
editing the host copy directly is the faster path for a same-day wording fix, at the cost of that
edit not being in git until someone copies it back.

Leave anything inside `{{double braces}}` exactly as it is — those are filled in with real values
(a user's name, a listing's title) at send time. Everything else is your words, verbatim.

**Fields:** `subject.txt`, `preheader.txt` (the one-line summary an inbox shows beside the
subject), `heading.txt`, `body.txt` (multiple paragraphs — separate with a blank line, same as
writing an email), `buttonLabel.txt` (omit this file for a message with no button).

**Not here, and not meant to be:** the branded shell — logo, colours, the footer's legal links —
is `emailLayout.ts`'s job. A button's destination URL is also code's job: it's a specific
listing/page computed per-send, not fixed text, even though the button's visible label is
editable here.

## `whatsapp/` — reference copy of what's *approved on Meta's servers*, not live content

This is the important difference. A WhatsApp message is never rendered by our own code the way an
email is — Meta stores the approved wording on its own servers once a template is approved, and a
send only ever fills in the template's variables ({{name}}, {{title}}, a button's link). Nothing
in `NotificationsService` reads these files at send time.

**Editing a file here changes nothing a real user sees, on its own.** It only takes effect if you:

1. Edit the file.
2. Re-run the matching creation script (`whatsapp_create_welcome_template.py` /
   `whatsapp_create_listing_posted_template.py` at the repo root) with `--submit`, which reads
   these same files and submits them as a **new** template — Meta does not let you edit an
   approved template's wording in place.
3. Wait for Meta's review (hours to a couple of days).
4. Update `WHATSAPP_WELCOME_TEMPLATE` / `WHATSAPP_LISTING_POSTED_TEMPLATE` in `.env` to the new
   template's name once it's approved.

Kept here anyway rather than left as constants inside the Python scripts, so all four
notifications' wording lives in one place someone can review together, and so the two scripts
don't each hold their own copy that could quietly say something different from what's in git.

**Fields:** `header.txt` (plain text only — Meta rejects a header carrying an emoji, newline, or
markdown formatting; the body has no such restriction), `body.txt`, `footer.txt`, `buttonLabel.txt`
and, for a template with a dynamic link, `buttonUrlBase.txt` (the fixed prefix) and
`buttonUrlExample.txt` (a realistic full example Meta's review requires).

`whatsapp/welcome/body.txt` uses positional `{{1}}` rather than `{{name}}` — that template was
submitted before this convention existed and Meta does not allow converting a template between
positional and named after submission. A resubmission under a new name could switch it; editing
this file to say `{{name}}` without also resubmitting would not.
