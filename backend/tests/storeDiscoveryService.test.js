jest.mock('../src/repositories/storeRepository');

const storeRepository = require('../src/repositories/storeRepository');
const storeService = require('../src/services/storeService');

beforeEach(() => {
  jest.resetAllMocks();
  storeRepository.listForUser.mockResolvedValue({ rows: [], total: 0 });
});

describe('storeService.listForUser', () => {
  test('passes the user id, cleaned filters, paging and the current time of day', async () => {
    await storeService.listForUser(5, {
      search: '  pune ',
      category: 'cafe',
      city: ['x'], // an array must be ignored
      minRating: '4',
      openNow: 'true',
      sortBy: 'overallRating',
      order: 'desc',
      page: '2',
      limit: '6',
    });

    const [userId, filters, paging, nowTime] = storeRepository.listForUser.mock.calls[0];
    expect(userId).toBe(5);
    expect(filters).toEqual({
      name: '',
      address: '',
      search: 'pune',
      city: '',
      category: 'CAFE',
      minRating: 4,
      openNow: true,
    });
    expect(paging).toEqual({ sortBy: 'overallRating', order: 'desc', limit: 6, offset: 6 });
    expect(nowTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  test('"openNow" is only true for "true" or "1"', async () => {
    await storeService.listForUser(1, { openNow: 'false' });
    await storeService.listForUser(1, { openNow: '1' });
    expect(storeRepository.listForUser.mock.calls[0][1].openNow).toBe(false);
    expect(storeRepository.listForUser.mock.calls[1][1].openNow).toBe(true);
  });

  test('an unknown category gives 400 and the database is never asked', async () => {
    await expect(storeService.listForUser(1, { category: 'SPACESHIP' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_CATEGORY',
    });
    expect(storeRepository.listForUser).not.toHaveBeenCalled();
  });

  test.each(['0', '6', 'abc'])('minRating "%s" gives 400', async (minRating) => {
    await expect(storeService.listForUser(1, { minRating })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_MIN_RATING',
    });
  });

  test('turns database rows into clean JSON and builds the pagination block', async () => {
    storeRepository.listForUser.mockResolvedValue({
      total: 25,
      rows: [
        {
          id: 1,
          name: 'Brew House Coffee Roasters Pune',
          address: '5 JM Road',
          city: 'Pune',
          category: 'CAFE',
          imageUrl: null,
          latitude: '18.520400', // DECIMAL arrives as text
          longitude: '73.856700',
          openingTime: '08:00:00',
          closingTime: '22:00:00',
          isOpenNow: 1,
          overallRating: '4.5',
          ratingCount: 2,
          myRating: null,
        },
      ],
    });

    const result = await storeService.listForUser(5, { limit: '10', page: '1' });

    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(result.items[0]).toMatchObject({
      id: 1,
      latitude: 18.5204,
      longitude: 73.8567,
      openingTime: '08:00',
      closingTime: '22:00',
      isOpenNow: true,
      overallRating: 4.5,
      ratingCount: 2,
      myRating: null,
    });
  });

  test('a store without opening hours has isOpenNow null', async () => {
    storeRepository.listForUser.mockResolvedValue({
      total: 1,
      rows: [{ id: 2, name: 'x', isOpenNow: null, overallRating: null, ratingCount: 0, myRating: null }],
    });
    const result = await storeService.listForUser(5, {});
    expect(result.items[0].isOpenNow).toBeNull();
    expect(result.items[0].overallRating).toBeNull();
  });

  test('never sends the store email or status to normal users', async () => {
    storeRepository.listForUser.mockResolvedValue({
      total: 1,
      rows: [{ id: 2, name: 'x', email: 'secret@example.com', status: 'ACTIVE', ratingCount: 0 }],
    });
    const result = await storeService.listForUser(5, {});
    expect(result.items[0]).not.toHaveProperty('email');
    expect(result.items[0]).not.toHaveProperty('status');
  });
});