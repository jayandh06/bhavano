import { buildUserSearchOr } from './user-search';

describe('buildUserSearchOr', () => {
  it('returns undefined for nothing to search on', () => {
    expect(buildUserSearchOr(undefined)).toBeUndefined();
    expect(buildUserSearchOr('')).toBeUndefined();
    expect(buildUserSearchOr('   ')).toBeUndefined();
  });

  /** The actual bug: a phone number or email pasted from a contact card, a spreadsheet or WhatsApp
   * routinely carries a leading/trailing space or newline, which Postgres `LIKE` matches literally
   * — a search for a real, correctly-spelled value returned nothing. A name is usually typed, not
   * pasted, which is why "the name search works but phone/email doesn't" was the reported shape. */
  it('trims the query, so a pasted value with stray whitespace still matches', () => {
    expect(buildUserSearchOr(' 9876543210 ')).toEqual(
      expect.arrayContaining([{ phone: { contains: '9876543210' } }]),
    );
    expect(buildUserSearchOr('r.jayandh@gmail.com\n')).toEqual(
      expect.arrayContaining([{ email: { contains: 'r.jayandh@gmail.com', mode: 'insensitive' } }]),
    );
  });

  it('always includes the plain name/phone/email clauses for an ordinary query', () => {
    expect(buildUserSearchOr('Ravi')).toEqual([
      { name: { contains: 'Ravi', mode: 'insensitive' } },
      { phone: { contains: 'Ravi' } },
      { email: { contains: 'Ravi', mode: 'insensitive' } },
    ]);
  });

  describe('phone-shaped queries — User.phone is always a bare 10-digit string', () => {
    it('strips spaces, dashes and parentheses down to the bare digits', () => {
      expect(buildUserSearchOr('94876 43797')).toEqual(
        expect.arrayContaining([{ phone: { contains: '9487643797' } }]),
      );
      expect(buildUserSearchOr('(948) 764-3797')).toEqual(
        expect.arrayContaining([{ phone: { contains: '9487643797' } }]),
      );
    });

    it('drops a leading +91 or 91 country code', () => {
      expect(buildUserSearchOr('+91 94876 43797')).toEqual(
        expect.arrayContaining([{ phone: { contains: '9487643797' } }]),
      );
      expect(buildUserSearchOr('919487643797')).toEqual(
        expect.arrayContaining([{ phone: { contains: '9487643797' } }]),
      );
    });

    it('drops a leading trunk 0', () => {
      expect(buildUserSearchOr('09487643797')).toEqual(
        expect.arrayContaining([{ phone: { contains: '9487643797' } }]),
      );
    });

    it('does not add a redundant clause when the query is already the bare digits', () => {
      const or = buildUserSearchOr('9487643797')!;
      expect(or.filter((c) => 'phone' in c)).toHaveLength(1);
    });

    it('never applies phone normalization to a name or email — only punctuation-and-digits queries qualify', () => {
      // "123 Main St" and an email both contain digits, but neither is phone-shaped (letters / @).
      expect(buildUserSearchOr('john123@gmail.com')!.filter((c) => 'phone' in c)).toEqual([
        { phone: { contains: 'john123@gmail.com' } },
      ]);
      expect(buildUserSearchOr('Flat 123')!.filter((c) => 'phone' in c)).toEqual([
        { phone: { contains: 'Flat 123' } },
      ]);
    });

    it('ignores a phone-shaped query that reduces to fewer than 3 digits — too short to be a real fragment', () => {
      const or = buildUserSearchOr('+91')!;
      expect(or.filter((c) => 'phone' in c)).toEqual([{ phone: { contains: '+91' } }]);
    });
  });
});
