/**
 * Facebook's "f" mark, simplified to a solid circle + letterform rather than an exact brand-path
 * reproduction — unlike GoogleIcon.tsx (whose precise mark Google's own sign-in guidelines
 * require), this is just a share-button affordance, where "unmistakably Facebook" matters more
 * than pixel-exact typography.
 */
export function FacebookIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <text x="12" y="16.5" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="13" fill="#fff">
        f
      </text>
    </svg>
  );
}
