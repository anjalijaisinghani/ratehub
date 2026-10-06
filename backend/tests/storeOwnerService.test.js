jest.mock('../src/repositories/storeRepository');
jest.mock('../src/repositories/ratingRepository');

const storeRepository = require('../src/repositories/storeRepository');
const ratingRepository = require('../src/repositories/ratingRepository');
const storeService = require('../src/services/storeService');
const ownerService = require('../src/services/ownerService');

beforeEach(() => jest.resetAllMocks());

describe('storeService.listForUser', () => {
  test('passes the logged-in user id and cleaned search text', async () => {
    storeRepository.listForUser.mockResolvedValue([]);

    await storeService.listForUser(5, { name: ' Fresh ', address: ['x'], sortBy: 'myRating', order: 'desc' });

    expect(storeRepository.listForUser).toHaveBeenCalledWith(5, {
      name: 'Fresh',
      address: '',
      sortBy: 'myRating',
      order: 'desc',
    });
  });
});

describe('storeService.submitRating', () => {
  test('a store that does not exist gives 404 and saves nothing', async () => {
    storeRepository.findById.mockResolvedValue(null);

    await expect(storeService.submitRating(2, '999', 4)).rejects.toMatchObject({
      statusCode: 404,
      code: 'STORE_NOT_FOUND',
    });
    expect(ratingRepository.upsert).not.toHaveBeenCalled();
  });

  test('a non-numeric store id gives 404 without touching the database', async () => {
    await expect(storeService.submitRating(2, 'abc', 4)).rejects.toMatchObject({ statusCode: 404 });
    expect(storeRepository.findById).not.toHaveBeenCalled();
  });

  test('success saves the rating for THIS user and store', async () => {
    storeRepository.findById.mockResolvedValue({ id: 1 });

    const result = await storeService.submitRating(2, '1', 4);

    expect(ratingRepository.upsert).toHaveBeenCalledWith({ userId: 2, storeId: 1, rating: 4 });
    expect(result).toEqual({ storeId: 1, rating: 4 });
  });
});

describe('ownerService.getDashboard', () => {
  test('owner with no store gets empty lists and no rater query runs', async () => {
    storeRepository.findWithStatsByOwner.mockResolvedValue([]);

    const result = await ownerService.getDashboard(3, {});

    expect(result).toEqual({ stores: [], raters: [] });
    expect(ratingRepository.findRatersByOwner).not.toHaveBeenCalled();
  });

  test('uses the owner id it was given for BOTH queries (no other owner can be requested)', async () => {
    storeRepository.findWithStatsByOwner.mockResolvedValue([{ id: 1, name: 'Fresh Mart Supermarket' }]);
    ratingRepository.findRatersByOwner.mockResolvedValue([{ id: 2, rating: 4 }]);

    const result = await ownerService.getDashboard(3, { sortBy: 'rating', order: 'desc' });

    expect(storeRepository.findWithStatsByOwner).toHaveBeenCalledWith(3);
    expect(ratingRepository.findRatersByOwner).toHaveBeenCalledWith(3, 'rating', 'desc');
    expect(result.raters).toHaveLength(1);
  });
});