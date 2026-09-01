import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One notification's editable copy — see `apps/bff/notification-templates/README.md` for how
 * to change these files without touching this one. */
export interface NotificationTemplate {
  subject: string;
  preheader: string;
  heading: string;
  /** `body.txt` split on blank lines — matches `EmailLayoutInput.paragraphs`, which renders each
   * entry as its own `<p>`. */
  paragraphs: string[];
  /** Undefined when the folder has no `buttonLabel.txt` — a message with no call to action, e.g.
   * a plain status update, is allowed to have no button at all. */
  buttonLabel?: string;
}

/** Read once per call rather than cached at boot, on purpose: `docker-compose.prod.yml`
 * bind-mounts this directory read-only into the container specifically so an edit made directly
 * on the app host takes effect on the next notification sent, with no restart. Caching here would
 * silence that — these are notification-volume reads (per listing posted, per welcome), not a
 * hot path, so the extra disk read costs nothing worth optimising away. */
function readField(dir: string, file: string): string | undefined {
  try {
    return readFileSync(join(templatesRoot(), dir, file), 'utf8').trim();
  } catch {
    return undefined;
  }
}

/** `process.cwd()` rather than `__dirname`: the Dockerfile's CMD runs `node dist/src/main` from
 * `WORKDIR /app/apps/bff`, and this directory sits beside `src/`/`dist/` at that same level,
 * never compiled itself — `__dirname` would resolve into `dist/src/` instead, one level too deep. */
function templatesRoot(): string {
  return join(process.cwd(), 'notification-templates');
}

/** Loads one *email* notification's template folder — pass the path under
 * `notification-templates/`, e.g. `"email/welcome"`. Only ever the `email/` half: the
 * `whatsapp/` folders exist for reference and for the `whatsapp_create_*_template.py` scripts to
 * read, never for this function — a WhatsApp send fills in an already-approved template's
 * variables, it never renders one, so there is nothing here for this loader to do with them. See
 * `notification-templates/README.md` for the full distinction.
 *
 * Throws if `subject.txt`/`preheader.txt`/`heading.txt`/`body.txt` are missing — a typo'd folder
 * name should fail loudly at the one call site that uses it, not silently send a blank email.
 * `buttonLabel.txt` alone is optional. */
export function loadTemplate(name: string): NotificationTemplate {
  const subject = readField(name, 'subject.txt');
  const preheader = readField(name, 'preheader.txt');
  const heading = readField(name, 'heading.txt');
  const body = readField(name, 'body.txt');
  if (!subject || !preheader || !heading || !body) {
    throw new Error(
      `Notification template "${name}" is missing a required file (subject.txt/preheader.txt/heading.txt/body.txt) under ${templatesRoot()}`,
    );
  }
  return {
    subject,
    preheader,
    heading,
    paragraphs: body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    buttonLabel: readField(name, 'buttonLabel.txt'),
  };
}

/** Fills `{{key}}` placeholders with plain string values — no escaping here, since every caller
 * passes the result into `renderEmail`'s own `paragraphs`/`heading`, which escapes for HTML
 * itself (see emailLayout.ts's `esc`). Escaping twice would turn a listing title's `&` into
 * `&amp;amp;`. */
export function renderTemplate(
  text: string,
  vars: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}
