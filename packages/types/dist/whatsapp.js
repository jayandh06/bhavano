"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsAppNumber = whatsAppNumber;
exports.whatsAppChatUrl = whatsAppChatUrl;
exports.ownerEnquiryText = ownerEnquiryText;
/** Digits wa.me expects: country code + number, no "+" or spaces. A bare 10-digit number is an
 * Indian mobile (how this app stores most phones). Null when it can't be a phone number. */
function whatsAppNumber(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10)
        return `91${digits}`;
    if (digits.length >= 11 && digits.length <= 15)
        return digits;
    return null;
}
/** Opens a chat with `phone` (the WhatsApp app when installed, WhatsApp Web otherwise), with the
 * message box pre-filled. */
function whatsAppChatUrl(phone, text) {
    const number = whatsAppNumber(phone);
    return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}
/** The pre-filled first message to a listing's owner. */
function ownerEnquiryText(listingTitle) {
    return `Hi, I saw your listing "${listingTitle}" on Bhavano. Is it still available?`;
}
