/**
 * WhatsApp's official glyph (the phone-handset-in-a-speech-bubble mark) on its brand green, same
 * spirit as FacebookIcon.tsx — "unmistakably WhatsApp" over pixel-exact brand-path reproduction.
 * Used in place of the generic `Icon name="message"`/`"share"` glyphs wherever a button is
 * specifically a WhatsApp action, not a generic share/message affordance.
 */
export function WhatsAppIcon({ className = "", size = "1em" }: { className?: string; size?: string | number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        fill="#fff"
        d="M16.59 13.39c-.24-.12-1.43-.7-1.65-.78-.22-.08-.39-.12-.55.12-.16.24-.63.78-.78.95-.14.16-.29.18-.53.06-.72-.36-1.49-.81-2.13-1.4a8.06 8.06 0 0 1-1.21-1.5c-.13-.22 0-.34.1-.46.14-.16.51-.59.6-.76.1-.16.05-.3-.02-.42-.07-.12-.52-1.25-.72-1.72-.15-.37-.31-.33-.42-.33-.1-.01-.22-.01-.34-.01-.12 0-.3.04-.47.22-.16.18-.63.62-.63 1.5 0 .89.65 1.75.74 1.87.09.12 1.24 1.9 3.02 2.6 1.78.7 1.78.47 2.1.44.32-.02 1.04-.42 1.19-.83.15-.4.15-.75.1-.83-.05-.07-.19-.12-.4-.22z"
      />
      <path
        fill="#fff"
        d="M12 5.5a6.5 6.5 0 0 0-5.56 9.86L5.5 18.5l3.26-.9A6.5 6.5 0 1 0 12 5.5zm0 1.3a5.2 5.2 0 1 1-2.76 9.62l-.2-.12-2.03.56.57-1.97-.13-.2A5.2 5.2 0 0 1 12 6.8z"
      />
    </svg>
  );
}
