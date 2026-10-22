import { CATEGORY_FIELD_CONFIG, defaultAttributesFor } from '@bhavano/types/categoryFields';
import { isReusableField, reuseAttributes } from '@bhavano/types/listingReuse';

describe('reuseAttributes', () => {
  const fields = CATEGORY_FIELD_CONFIG.apartment;

  it('only treats furnishing, amenities, preferences, brokerage and posted-by as reusable', () => {
    for (const field of fields) {
      if (isReusableField(field)) {
        expect(
          ['furnishing', 'amenities', 'preferences'].includes(field.section ?? '') ||
            field.key.startsWith('brokerage') ||
            field.key === 'fromBroker',
        ).toBe(true);
      }
    }
    // Property-specific facts are never copied.
    for (const key of ['carpetAreaSqft', 'bedrooms', 'floor', 'totalFloors']) {
      const field = fields.find((f) => f.key === key);
      if (field) expect(isReusableField(field)).toBe(false);
    }
  });

  it('copies reusable answers into blanks and leaves property facts alone', () => {
    const reusableField = fields.find((f) => isReusableField(f) && f.type === 'select' && f.options?.length);
    expect(reusableField).toBeDefined();
    const option = reusableField!.options![0].value;
    const previous = { [reusableField!.key]: option, carpetAreaSqft: '900', bedrooms: '3' };
    const current = { ...defaultAttributesFor('apartment') };
    delete current[reusableField!.key];

    const result = reuseAttributes('apartment', 'rent', current, previous);

    expect(result.attributes[reusableField!.key]).toBe(option);
    expect(result.copiedKeys).toContain(reusableField!.key);
    expect(result.attributes.carpetAreaSqft).toBeUndefined();
    expect(result.attributes.bedrooms).toBe(current.bedrooms);
  });

  it('never overwrites what the seller already entered', () => {
    const reusableField = fields.find((f) => isReusableField(f) && f.type === 'select' && (f.options?.length ?? 0) > 1)!;
    const [first, second] = reusableField.options!;
    const result = reuseAttributes('apartment', 'rent', { [reusableField.key]: second.value }, { [reusableField.key]: first.value });
    expect(result.attributes[reusableField.key]).toBe(second.value);
    expect(result.copiedKeys).not.toContain(reusableField.key);
  });

  it('skips a select value the form no longer offers', () => {
    const reusableField = fields.find((f) => isReusableField(f) && f.type === 'select' && f.options?.length)!;
    const result = reuseAttributes('apartment', 'rent', {}, { [reusableField.key]: 'not-an-option' });
    expect(result.copiedKeys).not.toContain(reusableField.key);
  });
});
