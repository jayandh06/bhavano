/**
 * Translates the component shape Msg91Provider already builds for MSG91's WhatsApp API into the
 * `components` array Meta's Cloud API expects, so the seven MSG91 sends can go straight to Meta
 * (WHATSAPP_TRANSPORT=meta) without each one being rewritten. See docs/plans/whatsapp-direct-meta-transport.md.
 *
 * MSG91 shape (one recipient's `components`):
 *   body_name:  { type: 'text', value: 'Ravi', parameter_name: 'name' }   named body variable
 *   body_1:     { type: 'text', value: '123456' }                          positional body variable
 *   button_1:   { subtype: 'url', type: 'text', value: 'suffix' }          dynamic URL button, 1-based
 */

export interface Msg91Component {
  type?: string;
  subtype?: string;
  value?: unknown;
  parameter_name?: string;
}

export type MetaComponent =
  | { type: 'body'; parameters: Array<{ type: 'text'; text: string; parameter_name?: string }> }
  | { type: 'button'; sub_type: 'url'; index: string; parameters: Array<{ type: 'text'; text: string }> };

const text = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

export function toMetaComponents(components: Record<string, Msg91Component> | undefined): MetaComponent[] {
  const out: MetaComponent[] = [];
  if (!components) return out;

  const named: Array<{ type: 'text'; text: string; parameter_name: string }> = [];
  const positional: Array<{ n: number; text: string }> = [];
  const buttons: Array<{ n: number; text: string }> = [];

  for (const [key, c] of Object.entries(components)) {
    if (!c) continue;
    const body = /^body_(.+)$/.exec(key);
    const button = /^button_(\d+)$/.exec(key);
    if (button) {
      buttons.push({ n: Number(button[1]), text: text(c.value) });
    } else if (body) {
      if (c.parameter_name) {
        named.push({ type: 'text', text: text(c.value), parameter_name: c.parameter_name });
      } else if (/^\d+$/.test(body[1])) {
        positional.push({ n: Number(body[1]), text: text(c.value) });
      }
    }
  }

  // A template is positional or named, never both, so only one of these is non-empty.
  if (named.length > 0) {
    out.push({ type: 'body', parameters: named });
  } else if (positional.length > 0) {
    positional.sort((a, b) => a.n - b.n);
    out.push({ type: 'body', parameters: positional.map((p) => ({ type: 'text' as const, text: p.text })) });
  }

  buttons
    .sort((a, b) => a.n - b.n)
    .forEach((b) =>
      out.push({
        type: 'button',
        sub_type: 'url',
        index: String(b.n - 1),
        parameters: [{ type: 'text', text: b.text }],
      }),
    );

  return out;
}
