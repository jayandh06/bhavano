/** Builds a schema.org FAQPage JSON-LD object from the same plain-string q/a array that feeds
 * the visible `<FaqGroup>` — one source of truth for both, no duplicated copy. */
export function faqPageJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
