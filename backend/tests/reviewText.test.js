const { normalizeReviewText, REVIEW_MIN, REVIEW_MAX } = require('../src/utils/reviewText');

describe('normalizeReviewText', () => {
  test('trims the text', () => {
    expect(normalizeReviewText('   Great service and friendly staff!   ')).toBe('Great service and friendly staff!');
  });

  test('all kinds of line breaks become \\n', () => {
    expect(normalizeReviewText('Line one is here\r\nLine two is here\rLine three here')).toBe(
      'Line one is here\nLine two is here\nLine three here'
    );
  });

  test('removes control characters', () => {
    expect(normalizeReviewText('Nice\u0000 place\u0007 here ok')).toBe('Nice place here ok');
  });

  test('keeps at most one blank line in a row', () => {
    expect(normalizeReviewText('First paragraph text\n\n\n\n\nSecond paragraph')).toBe(
      'First paragraph text\n\nSecond paragraph'
    );
  });

  test('HTML is kept as plain text (React escapes it when displaying)', () => {
    expect(normalizeReviewText('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
  });

  test('the length limits are 10 and 1000 characters, inclusive', () => {
    expect(REVIEW_MIN).toBe(10);
    expect(REVIEW_MAX).toBe(1000);
    expect(normalizeReviewText('a'.repeat(10))).toHaveLength(10);
    expect(normalizeReviewText('a'.repeat(1000))).toHaveLength(1000);
    expect(() => normalizeReviewText('a'.repeat(9))).toThrow(expect.objectContaining({ code: 'INVALID_REVIEW_TEXT' }));
    expect(() => normalizeReviewText('a'.repeat(1001))).toThrow(expect.objectContaining({ code: 'INVALID_REVIEW_TEXT' }));
  });

  test('an emoji counts as ONE character, like MySQL counts it', () => {
    expect(() => normalizeReviewText('😀'.repeat(10))).not.toThrow(); // 10 characters, though .length says 20
    expect(() => normalizeReviewText('😀'.repeat(1000))).not.toThrow();
    expect(() => normalizeReviewText('😀'.repeat(1001))).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => normalizeReviewText('😀'.repeat(9))).toThrow();
  });

  test.each([undefined, null, 12345678901, ['a long enough text'], { text: 'a long enough text' }])(
    'a non-string (%p) is rejected',
    (value) => {
      expect(() => normalizeReviewText(value)).toThrow(
        expect.objectContaining({ statusCode: 400, code: 'INVALID_REVIEW_TEXT' })
      );
    }
  );

  test('only spaces or control characters count as empty', () => {
    expect(() => normalizeReviewText('               ')).toThrow();
    expect(() => normalizeReviewText('\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u0000\u0001')).toThrow();
  });
});