import type { AnchorHTMLAttributes } from "react";

/** A link that does a full page load instead of a client-side navigation — used for links to a
 * screen that has remembered filters (`/`, `/logins`, ...).
 *
 * A bare-path visit is what middleware.ts answers with a redirect to the remembered filter. When
 * that redirect answers a client-side <Link> navigation, Next's router lands on the filtered page
 * but is left unable to act on the next <Link> click there (a date-range preset, a tab, a sort
 * header flash "pending" and snap back with no request sent). A document request takes the same
 * redirect and lands in a healthy state. See AdminNav.tsx and docs/plans/admin-remembered-filters.md.
 *
 * Spreading the props (rather than writing `<a href="/">` at each call site) is also what keeps
 * `@next/next/no-html-link-for-pages` from flagging every one of them for doing this on purpose. */
export function FullPageLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  // eslint-disable-next-line jsx-a11y/anchor-has-content -- children arrive through props
  return <a {...props} />;
}
