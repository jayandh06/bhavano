"use client";

export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  resetFieldsOnChange,
  style,
}: {
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  /** Field names on the same form to blank before submitting — e.g. changing City must clear
   * the now-stale Area selection, or the reload would silently resubmit the old city's area
   * and filter to nothing. */
  resetFieldsOnChange?: string[];
  style?: React.CSSProperties;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      onChange={(e) => {
        const form = e.currentTarget.form;
        if (form) {
          for (const fieldName of resetFieldsOnChange ?? []) {
            const field = form.elements.namedItem(fieldName);
            if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) field.value = "";
          }
        }
        e.currentTarget.form?.requestSubmit();
      }}
      style={style}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
