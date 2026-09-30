/** Digits wa.me expects: country code + number, no "+" or spaces. A bare 10-digit number is an
 * Indian mobile (how this app stores most phones). Null when it can't be a phone number. */
export function whatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/** Opens a chat with `phone` (the WhatsApp app when installed, WhatsApp Web otherwise), with the
 * message box pre-filled. */
export function whatsAppChatUrl(phone: string, text: string): string | null {
  const number = whatsAppNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** The pre-filled first message to a listing's owner. */
export function ownerEnquiryText(listingTitle: string): string {
  return `Hi, I saw your listing "${listingTitle}" on Bhavano. Is it still available?`;
}
