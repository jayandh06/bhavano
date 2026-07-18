/** Renders a schema.org JSON-LD block from a plain object — no library needed, this is just
 * `<script type="application/ld+json">{JSON.stringify(data)}</script>` with the "@context"
 * convenience baked in. Safe against injection: `data` is always our own structured object,
 * never raw user HTML, and JSON.stringify escapes `</script>`-breaking sequences on its own
 * for the characters that matter here (no user-controlled markup is ever serialized). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", ...data }) }}
    />
  );
}
