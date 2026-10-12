jest.mock('../src/repositories/storeRepository');
jest.mock('../src/repositories/ratingRepository');

const storeRepository = require('../src/repositories/storeRepository');
const ratingRepository = require('../src/repositories/ratingRepository');
const reviewService = require('../src/services/reviewService');

const GOOD = 'The staff were friendly and quick.';
const activeStore = { id: 1, status: 'ACTIVE' };

const savedRow = (overrides = {}) => ({
  id: 9,
  rating: 5,
  review_text: GOOD,
  reviewed_at: new Date('2026-01-01T10:00:00Z'),
  review_edited_at: null,
  ...overrides,
});

beforeEach(() => jest.resetAllMocks());

describe('reviewService.saveReview', () => {
  test.each([
    ['a store that does not exist', null],
    ['a hidden (INACTIVE) store', { id: 1, status: 'INACTIVE' }],
  ])('%s gives 404 and nothing is saved', async (_label, store) => {
    storeRepository.findById.mockResolvedValue(store);
    await expect(reviewService.saveReview(2, '1', { rating: 5, text: GOOD })).rejects.toMatchObject({
      statusCode: 404,
      code: 'STORE_NOT_FOUND',
    });
    expect(ratingRepository.saveReview).not.toHaveBeenCalled();
  });

  test('a non-numeric store id gives 404 without touching the database', async () => {
    await expect(reviewService.saveReview(2, 'abc', { rating: 5, text: GOOD })).rejects.toMatchObject({ statusCode: 404 });
    expect(storeRepository.findById).not.toHaveBeenCalled();
  });

  test('a first review: created, both dates start now, not edited', async () => {
    storeRepository.findById.mockResolvedValue(activeStore);
    ratingRepository.findByUserAndStore.mockResolvedValueOnce(null).mockResolvedValueOnce(savedRow());

    const result = await reviewService.saveReview(2, '1', { rating: 5, text: GOOD });

    const saved = ratingRepository.saveReview.mock.calls[0][0];
    expect(saved).toMatchObject({ userId: 2, storeId: 1, rating: 5, text: GOOD, editedAt: null });
    expect(saved.reviewedAt).toBeInstanceOf(Date);
    expect(result.created).toBe(true);
    expect(result.review).toMatchObject({ id: 9, text: GOOD });
  });

  test('adding text to a rating-only entry counts as creating a review', async () => {
    storeRepository.findById.mockResolvedValue(activeStore);
    ratingRepository.findByUserAndStore
      .mockResolvedValueOnce({ id: 9, rating: 3, review_text: null, reviewed_at: null, review_edited_at: null })
      .mockResolvedValueOnce(savedRow());

    expect((await reviewService.saveReview(2, '1', { rating: 3, text: GOOD })).created).toBe(true);
  });

  test('editing the TEXT keeps the original date and sets "edited"', async () => {
    storeRepository.findById.mockResolvedValue(activeStore);
    const original = savedRow();
    ratingRepository.findByUserAndStore.mockResolvedValueOnce(original).mockResolvedValueOnce(savedRow());

    const result = await reviewService.saveReview(2, '1', { rating: 5, text: `${GOOD} Edit: still great.` });

    const saved = ratingRepository.saveReview.mock.calls[0][0];
    expect(saved.reviewedAt).toBe(original.reviewed_at);
    expect(saved.editedAt).toBeInstanceOf(Date);
    expect(result.created).toBe(false);
  });

  test('changing only the stars is NOT an edit', async () => {
    storeRepository.findById.mockResolvedValue(activeStore);
    ratingRepository.findByUserAndStore.mockResolvedValueOnce(savedRow()).mockResolvedValueOnce(savedRow({ rating: 2 }));

    await reviewService.saveReview(2, '1', { rating: 2, text: GOOD });

    expect(ratingRepository.saveReview.mock.calls[0][0].editedAt).toBeNull();
  });

  test('an earlier "edited" date is kept when the text does not change again', async () => {
    storeRepository.findById.mockResolvedValue(activeStore);
    const editedAt = new Date('2026-01-05T08:00:00Z');
    ratingRepository.findByUserAndStore
      .mockResolvedValueOnce(savedRow({ review_edited_at: editedAt }))
      .mockResolvedValueOnce(savedRow());

    await reviewService.saveReview(2, '1', { rating: 4, text: GOOD });

    expect(ratingRepository.saveReview.mock.calls[0][0].editedAt).toBe(editedAt);
  });

  test('the text is cleaned before it is saved', async () => {
    storeRepository.findById.mockResolvedValue(activeStore);
    ratingRepository.findByUserAndStore.mockResolvedValueOnce(null).mockResolvedValueOnce(savedRow());

    await reviewService.saveReview(2, '1', { rating: 5, text: `  ${GOOD}\r\n\r\n\r\n\r\nMore.  ` });

    expect(ratingRepository.saveReview.mock.calls[0][0].text).toBe(`${GOOD}\n\nMore.`);
  });

  test('invalid text gives 400 and nothing is saved', async () => {
    storeRepository.findById.mockResolvedValue(activeStore);
    await expect(reviewService.saveReview(2, '1', { rating: 5, text: 'short' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_REVIEW_TEXT',
    });
    expect(ratingRepository.saveReview).not.toHaveBeenCalled();
  });

  test.each([0, 6, 3.5, '4', null, undefined])('rating %p gives 400 and nothing is saved', async (rating) => {
    storeRepository.findById.mockResolvedValue(activeStore);
    await expect(reviewService.saveReview(2, '1', { rating, text: GOOD })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_RATING',
    });
    expect(ratingRepository.saveReview).not.toHaveBeenCalled();
  });
});

describe('reviewService.deleteReview', () => {
  test('nothing to delete gives 404 REVIEW_NOT_FOUND', async () => {
    ratingRepository.deleteByUserAndStore.mockResolvedValue(false);
    await expect(reviewService.deleteReview(2, '1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'REVIEW_NOT_FOUND',
    });
  });

  test('deletes only the logged-in user\'s own row', async () => {
    ratingRepository.deleteByUserAndStore.mockResolvedValue(true);
    await expect(reviewService.deleteReview(2, '1')).resolves.toBeUndefined();
    expect(ratingRepository.deleteByUserAndStore).toHaveBeenCalledWith(2, 1);
  });

  test('a non-numeric store id gives 404 without touching the database', async () => {
    await expect(reviewService.deleteReview(2, 'abc')).rejects.toMatchObject({ statusCode: 404 });
    expect(ratingRepository.deleteByUserAndStore).not.toHaveBeenCalled();
  });
});

describe('reviewService.listReviews', () => {
  beforeEach(() => {
    storeRepository.findById.mockResolvedValue(activeStore);
    ratingRepository.listReviews.mockResolvedValue({ rows: [], total: 0 });
  });

  test('defaults: newest first, 10 per page, no rating filter', async () => {
    await reviewService.listReviews(2, '1', {});
    expect(ratingRepository.listReviews).toHaveBeenCalledWith(1, 2, {
      rating: null,
      sortBy: undefined,
      order: 'desc',
      limit: 10,
      offset: 0,
    });
  });

  test('passes the rating filter, sorting and paging', async () => {
    await reviewService.listReviews(2, '1', { rating: '5', sortBy: 'rating', order: 'asc', page: '3', limit: '5' });
    expect(ratingRepository.listReviews).toHaveBeenCalledWith(1, 2, {
      rating: 5,
      sortBy: 'rating',
      order: 'asc',
      limit: 5,
      offset: 10,
    });
  });

  test.each(['0', '6', 'abc', '4.5', '1e1'])('rating filter "%s" gives 400', async (rating) => {
    await expect(reviewService.listReviews(2, '1', { rating })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_RATING_FILTER',
    });
    expect(ratingRepository.listReviews).not.toHaveBeenCalled();
  });

  test('a hidden store gives 404', async () => {
    storeRepository.findById.mockResolvedValue({ id: 1, status: 'INACTIVE' });
    await expect(reviewService.listReviews(2, '1', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  test('turns rows into clean JSON with the page information', async () => {
    ratingRepository.listReviews.mockResolvedValue({
      total: 12,
      rows: [{ id: 1, rating: 5, text: GOOD, reviewedAt: new Date(), editedAt: null, reviewerName: 'Alice', isMine: 1 }],
    });
    const result = await reviewService.listReviews(2, '1', { limit: '5' });
    expect(result.pagination).toEqual({ page: 1, limit: 5, total: 12, totalPages: 3 });
    expect(result.items[0]).toMatchObject({ id: 1, isMine: true, reviewerName: 'Alice' });
  });
});

describe('reviewService.getStoreDetails', () => {
  const baseRow = {
    id: 1,
    name: 'Fresh Mart Integration Test Store',
    ratingCount: 3,
    reviewCount: 2,
    overallRating: '4.0',
    myRating: 5,
    isOpenNow: null,
    latitude: null,
    longitude: null,
  };

  test('an unknown or hidden store gives 404', async () => {
    storeRepository.findActiveWithStats.mockResolvedValue(null);
    await expect(reviewService.getStoreDetails(2, '1')).rejects.toMatchObject({ code: 'STORE_NOT_FOUND' });
  });

  test('a non-numeric id gives 404 without touching the database', async () => {
    await expect(reviewService.getStoreDetails(2, 'abc')).rejects.toMatchObject({ statusCode: 404 });
    expect(storeRepository.findActiveWithStats).not.toHaveBeenCalled();
  });

  test('merges the profile, the star distribution and my own review', async () => {
    storeRepository.findActiveWithStats.mockResolvedValue({ ...baseRow, email: 'secret@example.com' });
    ratingRepository.getDistribution.mockResolvedValue([{ rating: 5, count: 2 }, { rating: 3, count: 1 }]);
    ratingRepository.findByUserAndStore.mockResolvedValue(savedRow({ id: 8 }));

    const result = await reviewService.getStoreDetails(2, '1');

    expect(result).toMatchObject({ id: 1, overallRating: 4, reviewCount: 2, myRating: 5 });
    expect(result.distribution).toEqual([
      { rating: 1, count: 0 },
      { rating: 2, count: 0 },
      { rating: 3, count: 1 },
      { rating: 4, count: 0 },
      { rating: 5, count: 2 },
    ]);
    expect(result.myReview).toMatchObject({ id: 8, rating: 5, text: GOOD });
    expect(result).not.toHaveProperty('email');
  });

  test('a stars-only rating is not a review: myReview is null', async () => {
    storeRepository.findActiveWithStats.mockResolvedValue(baseRow);
    ratingRepository.getDistribution.mockResolvedValue([]);
    ratingRepository.findByUserAndStore.mockResolvedValue({ id: 8, rating: 5, review_text: null });

    expect((await reviewService.getStoreDetails(2, '1')).myReview).toBeNull();
  });
});