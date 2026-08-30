import { LEGAL_ENTITY } from '@bhavano/types/legalEntity';

/** Brand colours, copied from apps/web's globals.css light theme rather than imported: this is a
 * different runtime with no CSS pipeline, and email needs literal hex anyway. Light-theme values
 * only — an email cannot follow the reader's site theme, and every client renders it differently. */
const GREEN = '#0b3d2e';
const ON_GREEN = '#efe9dc';
const TEXT = '#1a1a1a';
const MUTED = '#6b6b6b';
const BORDER = '#e4e0d8';
const PAGE_BG = '#f6f4ef';

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailLayoutInput {
  /** Shown under the logo, as the email's own heading. */
  heading: string;
  /** Paragraphs, in order. Plain text — escaped, so a listing title with an ampersand or a quote
   * in it cannot break the markup or inject anything. */
  paragraphs: string[];
  button?: EmailButton;
  /** The one-line summary inbox lists show beside the subject. Without it, clients fall back to
   * scraping the first text they find, which is usually the logo's alt text. */
  preheader: string;
}

/** Escapes text destined for HTML. Listing titles and user names both reach these emails, and
 * neither is trusted markup. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function siteUrl(): string {
  return process.env.PUBLIC_SITE_URL ?? 'https://www.bhavano.com';
}

/**
 * Wraps message content in the branded shell every Bhavano email shares.
 *
 * Written the way email has to be written rather than the way a page would be: tables for layout
 * and styles inline on every element, because Outlook renders through Word's HTML engine, which
 * ignores most of a stylesheet and much of flexbox. A `<style>` block would be silently dropped by
 * several clients, so nothing here depends on one.
 *
 * Colours are stated explicitly on both background and text of every block. Clients that
 * force-darken an email invert unspecified backgrounds while leaving text alone, which is how
 * "black on black" happens.
 *
 * Callers pass plain paragraphs; the caller also builds a plain-text version for the same message,
 * since a mail with no text/plain part scores worse with spam filters and is unreadable in clients
 * that prefer text.
 */
export function renderEmail(input: EmailLayoutInput): string {
  const { heading, paragraphs, button, preheader } = input;
  const site = siteUrl();

  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT};">${esc(p)}</p>`,
    )
    .join('');

  // A "bulletproof" button: a table cell with a background colour and a link filling it. A styled
  // <a> alone loses its background in Outlook and collapses to bare underlined text.
  const cta = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
         <tr>
           <td align="center" bgcolor="${GREEN}" style="border-radius:8px;">
             <a href="${esc(button.url)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:bold;color:${ON_GREEN};text-decoration:none;border-radius:8px;">${esc(button.label)}</a>
           </td>
         </tr>
       </table>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BG};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid ${BORDER};">
            <a href="${site}" style="text-decoration:none;">
              <img src="${site}/logo.png" width="40" height="40" alt="Bhavano" style="display:inline-block;vertical-align:middle;border:0;border-radius:9px;">
              <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:${GREEN};">Bhavano</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:${TEXT};">${esc(heading)}</h1>
            ${body}
            ${cta}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid ${BORDER};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${MUTED};">
              <a href="${site}" style="color:${GREEN};text-decoration:none;font-weight:bold;">Browse listings</a> &nbsp;·&nbsp;
              <a href="${site}/post" style="color:${GREEN};text-decoration:none;font-weight:bold;">Post a free ad</a> &nbsp;·&nbsp;
              <a href="${site}/help" style="color:${GREEN};text-decoration:none;font-weight:bold;">Help</a>
            </p>
            <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
              ${esc(LEGAL_ENTITY.brand)} is a product of ${esc(LEGAL_ENTITY.legalName)}.<br>
              Questions? Reply to this email or write to
              <a href="mailto:${LEGAL_ENTITY.supportEmail}" style="color:${MUTED};">${LEGAL_ENTITY.supportEmail}</a>.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
