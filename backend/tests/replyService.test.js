jest.mock('../src/repositories/ratingRepository');

const ratingRepository = require('../src/repositories/ratingRepository');
const replyService = require('../src/services/replyService');

const REPLY = 'Thank you for visiting us. We are glad you liked it!';

const reviewRow = (overrides = {}) => ({
  id: 9,
  review_text: 'The staff were friendly and quick.',
  reply_text: null,
  replied_at: null,
  reply_edited_at: null,
  ...overrides,
});

beforeEach(() => jest.resetAllMocks());

describe('replyService.saveReply', () => {
  test('a review that is not in the owner\'s store (or does not exist) gives 404 and saves nothing', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(null);
    await expect(replyService.saveReply(7, '9', REPLY)).rejects.toMatchObject({
      statusCode: 404,
      code: 'REVIEW_NOT_FOUND',
    });
    expect(ratingRepository.saveReply).not.toHaveBeenCalled();
  });

  test('the lookup always uses the owner id it was given', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(reviewRow());
    await replyService.saveReply(7, '9', REPLY);
    expect(ratingRepository.findReviewForOwner).toHaveBeenCalledWith(7, 9);
  });

  test('a non-numeric review id gives 404 without touching the database', async () => {
    await expect(replyService.saveReply(7, 'abc', REPLY)).rejects.toMatchObject({ statusCode: 404 });
    expect(ratingRepository.findReviewForOwner).not.toHaveBeenCalled();
  });

  test('a first reply: created, dated now, not edited', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(reviewRow());

    const result = await replyService.saveReply(7, '9', REPLY);

    const [id, text, repliedAt, editedAt] = ratingRepository.saveReply.mock.calls[0];
    expect(id).toBe(9);
    expect(text).toBe(REPLY);
    expect(repliedAt).toBeInstanceOf(Date);
    expect(editedAt).toBeNull();
    expect(result.created).toBe(true);
    expect(result.reply).toMatchObject({ text: REPLY, editedAt: null });
  });

  test('editing the TEXT keeps the original date and sets "edited"', async () => {
    const original = new Date('2026-02-01T09:00:00Z');
    ratingRepository.findReviewForOwner.mockResolvedValue(reviewRow({ reply_text: REPLY, replied_at: original }));

    const result = await replyService.saveReply(7, '9', `${REPLY} Please visit again.`);

    const [, , repliedAt, editedAt] = ratingRepository.saveReply.mock.calls[0];
    expect(repliedAt).toBe(original);
    expect(editedAt).toBeInstanceOf(Date);
    expect(result.created).toBe(false);
  });

  test('saving the same text again changes nothing (no new "edited" mark)', async () => {
    const edited = new Date('2026-02-02T09:00:00Z');
    ratingRepository.findReviewForOwner.mockResolvedValue(
      reviewRow({ reply_text: REPLY, replied_at: new Date('2026-02-01T09:00:00Z'), reply_edited_at: edited })
    );

    await replyService.saveReply(7, '9', REPLY);

    expect(ratingRepository.saveReply.mock.calls[0][3]).toBe(edited);
  });

  test('the text is cleaned before it is saved', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(reviewRow());
    await replyService.saveReply(7, '9', `  ${REPLY}\r\n\r\n\r\n\r\nSee you!  `);
    expect(ratingRepository.saveReply.mock.calls[0][1]).toBe(`${REPLY}\n\nSee you!`);
  });

  test('invalid text gives 400 INVALID_REPLY_TEXT and nothing is saved', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(reviewRow());
    await expect(replyService.saveReply(7, '9', 'Hi')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_REPLY_TEXT',
    });
    expect(ratingRepository.saveReply).not.toHaveBeenCalled();
  });
});

describe('replyService.deleteReply', () => {
  test('someone else\'s review gives 404', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(null);
    await expect(replyService.deleteReply(7, '9')).rejects.toMatchObject({ code: 'REVIEW_NOT_FOUND' });
    expect(ratingRepository.clearReply).not.toHaveBeenCalled();
  });

  test('a review without a reply gives 404 REPLY_NOT_FOUND', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(reviewRow());
    await expect(replyService.deleteReply(7, '9')).rejects.toMatchObject({
      statusCode: 404,
      code: 'REPLY_NOT_FOUND',
    });
  });

  test('removes the reply of that review', async () => {
    ratingRepository.findReviewForOwner.mockResolvedValue(reviewRow({ reply_text: REPLY, replied_at: new Date() }));
    await replyService.deleteReply(7, '9');
    expect(ratingRepository.clearReply).toHaveBeenCalledWith(9);
  });
});

describe('replyService.listForOwner', () => {
  beforeEach(() => ratingRepository.listReviewsForOwner.mockResolvedValue({ rows: [], total: 0 }));

  test('defaults: no filters, newest first, 10 per page', async () => {
    await replyService.listForOwner(7, {});
    expect(ratingRepository.listReviewsForOwner).toHaveBeenCalledWith(7, {
      rating: null,
      replied: null,
      sortBy: undefined,
      order: 'desc',
      limit: 10,
      offset: 0,
    });
  });

  test('passes the filters, sorting and paging', async () => {
    await replyService.listForOwner(7, { rating: '2', replied: 'false', sortBy: 'helpful', order: 'asc', page: '2', limit: '5' });
    expect(ratingRepository.listReviewsForOwner).toHaveBeenCalledWith(7, {
      rating: 2,
      replied: false,
      sortBy: 'helpful',
      order: 'asc',
      limit: 5,
      offset: 5,
    });
  });

  test('replied=true and replied=TRUE both mean "already replied"', async () => {
    await replyService.listForOwner(7, { replied: 'true' });
    await replyService.listForOwner(7, { replied: 'TRUE' });
    expect(ratingRepository.listReviewsForOwner.mock.calls[0][1].replied).toBe(true);
    expect(ratingRepository.listReviewsForOwner.mock.calls[1][1].replied).toBe(true);
  });

  test.each([['rating', '0'], ['rating', '6'], ['rating', 'x'], ['replied', 'maybe'], ['replied', '1']])(
    'bad %s "%s" gives 400',
    async (field, value) => {
      await expect(replyService.listForOwner(7, { [field]: value })).rejects.toMatchObject({ statusCode: 400 });
      expect(ratingRepository.listReviewsForOwner).not.toHaveBeenCalled();
    }
  );

  test('turns rows into clean JSON with the page information', async () => {
    ratingRepository.listReviewsForOwner.mockResolvedValue({
      total: 11,
      rows: [{ id: 1, rating: 3, text: 'Okay', reviewerName: 'Bob', storeName: 'Fresh Mart', helpfulCount: '2', replyText: null }],
    });
    const result = await replyService.listForOwner(7, { limit: '5' });
    expect(result.pagination).toEqual({ page: 1, limit: 5, total: 11, totalPages: 3 });
    expect(result.items[0]).toMatchObject({ id: 1, helpfulCount: 2, reply: null, storeName: 'Fresh Mart' });
  });
});