# Notification email templates

Plain text, one file per field, one folder per notification. Edit the wording here directly — no
TypeScript, no rebuild required to see a change take effect (see the bind mount note below).

## Editing an existing message

Open the folder for the notification (e.g. `listing-posted/`) and edit whichever field's text you
want to change. Leave anything inside `{{double braces}}` exactly as it is — those are filled in
by code with real values (a user's name, a listing's title) at send time. Everything else is your
words, verbatim.

## Adding a new notification

Create a new folder here with the same five files (`subject.txt`, `preheader.txt`, `heading.txt`,
`body.txt`, `buttonLabel.txt` — omit `buttonLabel.txt` if the message has no button), then call
`loadTemplate('your-folder-name')` from `NotificationsService`. `body.txt` supports multiple
paragraphs — separate them with a blank line, the same way you'd write an email.

## What lives in code, not here

The branded shell around this content — the logo, the colours, the footer's legal links — is
`emailLayout.ts`'s job, not a template file's. These files hold only the words: what the email
says, not how it's laid out. A button's destination URL is also code's job (it's the specific
listing/page being linked to, computed per-send, not fixed text), even though the button's label
is editable here.

## On the live server

`docker-compose.prod.yml` bind-mounts this folder read-only into the bff container, and
`templateLoader.ts` reads the files fresh on every send rather than caching them at boot — so an
edit made directly on the app host (`~/bhavano/apps/bff/notification-templates/...`) takes effect
on the very next notification, no restart needed. A change made here in git still needs the normal
`git pull` + redeploy to reach the server the usual way; editing the host copy directly is the
faster path for a same-day wording tweak, at the cost of that edit not being tracked until someone
copies it back into git.
