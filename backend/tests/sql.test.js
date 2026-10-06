const { resolveSort, cleanString, likePattern } = require('../src/utils/sql');

const allowed = { name: 's.name', rating: 'rating' };

describe('resolveSort', () => {
  test('accepts a whitelisted column', () => {
    expect(resolveSort('rating', 'desc', allowed, 'name')).toEqual({
      key: 'rating',
      column: 'rating',
      direction: 'DESC',
    });
  });

  test('unknown column falls back to the default', () => {
    expect(resolveSort('password_hash', 'asc', allowed, 'name').column).toBe('s.name');
  });

  test('prototype keys cannot be used (constructor, __proto__, toString)', () => {
    for (const evil of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(resolveSort(evil, 'asc', allowed, 'name').column).toBe('s.name');
    }
  });

  test('array or object input falls back to defaults', () => {
    expect(resolveSort(['rating'], ['desc'], allowed, 'name')).toMatchObject({
      column: 's.name',
      direction: 'ASC',
    });
  });

  test('anything except "desc" means ASC; direction is case-insensitive', () => {
    expect(resolveSort('name', 'DESC', allowed, 'name').direction).toBe('DESC');
    expect(resolveSort('name', 'drop table', allowed, 'name').direction).toBe('ASC');
    expect(resolveSort('name', undefined, allowed, 'name').direction).toBe('ASC');
  });
});

describe('cleanString', () => {
  test('trims strings', () => expect(cleanString('  hi  ')).toBe('hi'));
  test('rejects arrays, objects and undefined', () => {
    expect(cleanString(['a', 'b'])).toBe('');
    expect(cleanString({ a: 1 })).toBe('');
    expect(cleanString(undefined)).toBe('');
  });
});

describe('likePattern', () => {
  test('wraps in % and escapes wildcards', () => {
    expect(likePattern('abc')).toBe('%abc%');
    expect(likePattern('50%_off')).toBe('%50\\%\\_off%');
  });
});