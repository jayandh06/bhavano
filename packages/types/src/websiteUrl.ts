/** The seller's "Website (optional)" field is plain text, and people type other things into it (one owner pasted their whole description, which the listing page then
 * turned into a link with spaces in it, and a crawler reported it as a broken URL). This returns the address to link to, or null when the text is not a web address.
 * Only http / https are ever linked: a typed `javascript:` or `data:` value must never become a link, and a bare "yourbusiness.com" gets https://. */
const WEBSITE = /^(https?:\/\/)?([\p{L}\p{N}-]+\.)+[\p{L}]{2,}(:\d{1,5})?([/?#]\S*)?$/iu;

export function websiteUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text === "" || text.length > 300 || /\s/.test(text)) return null;
  if (!WEBSITE.test(text)) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
}

export const WEBSITE_URL_MESSAGE = "Website must be a web address like www.example.com (or leave it empty).";
