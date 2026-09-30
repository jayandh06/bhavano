/** Digits wa.me expects: country code + number, no "+" or spaces. A bare 10-digit number is an
 * Indian mobile (how this app stores most phones). Null when it can't be a phone number. */
export declare function whatsAppNumber(phone: string): string | null;
/** Opens a chat with `phone` (the WhatsApp app when installed, WhatsApp Web otherwise), with the
 * message box pre-filled. */
export declare function whatsAppChatUrl(phone: string, text: string): string | null;
/** The pre-filled first message to a listing's owner. */
export declare function ownerEnquiryText(listingTitle: string): string;
