import { parseListingDescription } from '@bhavano/types/listingDescriptionFormat';

describe('parseListingDescription', () => {
  it('parses a plain string with no markdown-ish syntax as a single paragraph', () => {
    expect(parseListingDescription('A well-kept 2BHK in Koramangala.')).toEqual([
      { type: 'paragraph', runs: [{ text: 'A well-kept 2BHK in Koramangala.', bold: false }] },
    ]);
  });

  it('splits blank-line-separated text into separate paragraphs', () => {
    const blocks = parseListingDescription('First paragraph.\n\nSecond paragraph.');
    expect(blocks).toEqual([
      { type: 'paragraph', runs: [{ text: 'First paragraph.', bold: false }] },
      { type: 'paragraph', runs: [{ text: 'Second paragraph.', bold: false }] },
    ]);
  });

  it('joins a single line break within one paragraph into one block', () => {
    const blocks = parseListingDescription('Line one\nLine two.');
    expect(blocks).toEqual([{ type: 'paragraph', runs: [{ text: 'Line one Line two.', bold: false }] }]);
  });

  it('parses **bold** runs within a paragraph', () => {
    const blocks = parseListingDescription('Close to **MG Road Metro** and shops.');
    expect(blocks).toEqual([
      {
        type: 'paragraph',
        runs: [
          { text: 'Close to ', bold: false },
          { text: 'MG Road Metro', bold: true },
          { text: ' and shops.', bold: false },
        ],
      },
    ]);
  });

  it('parses a block of consecutive "- " lines as a bullet list', () => {
    const blocks = parseListingDescription('- Semi-furnished\n- Covered parking\n- Power backup');
    expect(blocks).toEqual([
      {
        type: 'bullets',
        items: [
          [{ text: 'Semi-furnished', bold: false }],
          [{ text: 'Covered parking', bold: false }],
          [{ text: 'Power backup', bold: false }],
        ],
      },
    ]);
  });

  it('also accepts "• " as a bullet marker', () => {
    const blocks = parseListingDescription('• Semi-furnished\n• Covered parking');
    expect(blocks[0].type).toBe('bullets');
  });

  it('falls back to a plain paragraph when only some lines in a block start with "- "', () => {
    // A dash used as punctuation, not a one-item list — e.g. "2BHK - fully furnished".
    const blocks = parseListingDescription('2BHK - fully furnished\nGreat location.');
    expect(blocks).toEqual([
      { type: 'paragraph', runs: [{ text: '2BHK - fully furnished Great location.', bold: false }] },
    ]);
  });

  it('parses bold runs within individual bullet items', () => {
    const blocks = parseListingDescription('- **2** bedrooms\n- **1** bathroom');
    expect(blocks).toEqual([
      {
        type: 'bullets',
        items: [
          [
            { text: '2', bold: true },
            { text: ' bedrooms', bold: false },
          ],
          [
            { text: '1', bold: true },
            { text: ' bathroom', bold: false },
          ],
        ],
      },
    ]);
  });

  it('handles a mix of paragraphs and a bullet list', () => {
    const text = 'Intro paragraph.\n\n- Point one\n- Point two\n\nClosing paragraph.';
    const blocks = parseListingDescription(text);
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'bullets', 'paragraph']);
  });

  it('returns an empty array for an empty or whitespace-only string', () => {
    expect(parseListingDescription('')).toEqual([]);
    expect(parseListingDescription('   \n\n  ')).toEqual([]);
  });
});
