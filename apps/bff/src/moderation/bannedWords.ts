/** Small curated list of common marketplace spam/scam markers — case-insensitive
 * substring match against the listing title and any string attribute values.
 * Not exhaustive; tune as real submissions come in. */
export const BANNED_WORDS: string[] = [
  "wire transfer",
  "western union",
  "click here",
  "whatsapp only",
  "guaranteed profit",
  "act now",
  "free money",
  "no questions asked",
  "cash only no receipt",
  "bitcoin payment only",
  "crypto payment only",
  "advance payment required",
  "processing fee required",
  "lottery winner",
  "inheritance fund",
  "double your money",
  "100% profit",
  "urgent sale must sell today",
  "no inspection allowed",
  "escrow service required",
  "send otp to confirm",
];

export function findBannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  return BANNED_WORDS.find((word) => lower.includes(word)) ?? null;
}
