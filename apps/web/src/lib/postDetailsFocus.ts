/** Where the Details step's issue targets live on the page. Targets come from `postDetailsIssues`
 * (`@bhavano/types/postDetailsIssues`); each field carries an id of the form `post-field-<target>` (attribute
 * fields use `post-field-attr:<key>`). */
export function elementIdForTarget(target: string): string {
  // Posted by is the `fromBroker` attribute field; a brokerage-against-price problem is about the price.
  if (target === "posted_by") return "post-field-attr:fromBroker";
  if (target === "brokerage") return "post-field-price";
  return `post-field-${target}`;
}

/** The attribute key a target belongs to, or null for the wizard's own fields (location, price, photos, ...). */
export function attributeKeyForTarget(target: string): string | null {
  if (target === "posted_by") return "fromBroker";
  return target.startsWith("attr:") ? target.slice("attr:".length) : null;
}

/** Scrolls the field for `target` to the middle of the screen and puts focus in it. A section the seller collapsed
 * is opened first. Returns false when the field is not on the page. */
export function scrollToTarget(target: string): boolean {
  const el = document.getElementById(elementIdForTarget(target));
  if (!el) return false;
  let node: HTMLElement | null = el;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const focusable = el.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea, button");
  // preventScroll: the smooth scroll above is already on its way.
  focusable?.focus({ preventScroll: true });
  return true;
}
