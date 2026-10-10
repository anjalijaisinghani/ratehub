const { parsePagination, buildPagination } = require('../src/utils/pagination');

describe('parsePagination', () => {
  test('reads page and limit and works out the offset', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  test('defaults when nothing is sent', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 12, offset: 0 });
    expect(parsePagination({}, { defaultLimit: 10 })).toEqual({ page: 1, limit: 10, offset: 0 });
  });

  test('the limit can never exceed the maximum (nobody can download the whole table)', () => {
    expect(parsePagination({ limit: '1000' }).limit).toBe(50);
    expect(parsePagination({ limit: '1000' }, { maxLimit: 20 }).limit).toBe(20);
  });

  test('garbage, zero and negative values fall back to the defaults', () => {
    expect(parsePagination({ page: 'abc', limit: '-5' })).toEqual({ page: 1, limit: 12, offset: 0 });
    expect(parsePagination({ page: '0', limit: '0' })).toEqual({ page: 1, limit: 12, offset: 0 });
  });

  test('arrays and objects (?page[]=2) are ignored', () => {
    expect(parsePagination({ page: ['2'], limit: { a: 1 } })).toEqual({ page: 1, limit: 12, offset: 0 });
  });
});

describe('buildPagination', () => {
  test('counts the pages, rounding up', () => {
    expect(buildPagination(2, 10, 25)).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
    expect(buildPagination(1, 10, 20).totalPages).toBe(2);
  });

  test('no results means zero pages', () => {
    expect(buildPagination(1, 12, 0).totalPages).toBe(0);
  });
});