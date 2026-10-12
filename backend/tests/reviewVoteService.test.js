jest.mock('../src/repositories/reviewVoteRepository');

const reviewVoteRepository = require('../src/repositories/reviewVoteRepository');
const reviewVoteService = require('../src/services/reviewVoteService');

const votable = (overrides = {}) => ({
  id: 9,
  user_id: 4, // the author
  review_text: 'The staff were friendly and quick.',
  store_status: 'ACTIVE',
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  reviewVoteRepository.findVotable.mockResolvedValue(votable());
  reviewVoteRepository.count.mockResolvedValue(3);
});

describe('reviewVoteService.setHelpful', () => {
  test.each([['abc', '9'], ['1', 'abc'], ['0', '9'], ['1', '-4']])(
    'store "%s" / review "%s": 404 without touching the database',
    async (storeId, reviewId) => {
      await expect(reviewVoteService.setHelpful(2, storeId, reviewId, true)).rejects.toMatchObject({
        statusCode: 404,
        code: 'REVIEW_NOT_FOUND',
      });
      expect(reviewVoteRepository.findVotable).not.toHaveBeenCalled();
    }
  );

  test.each([
    ['a review that does not exist (or is in another store)', null],
    ['a stars-only rating (no text)', votable({ review_text: null })],
    ['a review in a hidden store', votable({ store_status: 'INACTIVE' })],
  ])('%s gives 404 and no vote is saved', async (_label, row) => {
    reviewVoteRepository.findVotable.mockResolvedValue(row);
    await expect(reviewVoteService.setHelpful(2, '1', '9', true)).rejects.toMatchObject({
      statusCode: 404,
      code: 'REVIEW_NOT_FOUND',
    });
    expect(reviewVoteRepository.add).not.toHaveBeenCalled();
  });

  test('the review is looked up together with its store id (a review of another store is not found)', async () => {
    await reviewVoteService.setHelpful(2, '1', '9', true);
    expect(reviewVoteRepository.findVotable).toHaveBeenCalledWith(9, 1);
  });

  test('you cannot vote on your own review (403) and nothing is saved', async () => {
    await expect(reviewVoteService.setHelpful(4, '1', '9', true)).rejects.toMatchObject({
      statusCode: 403,
      code: 'CANNOT_VOTE_OWN_REVIEW',
    });
    expect(reviewVoteRepository.add).not.toHaveBeenCalled();
    expect(reviewVoteRepository.remove).not.toHaveBeenCalled();
  });

  test('marking helpful adds my vote and returns the new count', async () => {
    const result = await reviewVoteService.setHelpful(2, '1', '9', true);
    expect(reviewVoteRepository.add).toHaveBeenCalledWith(2, 9, expect.any(Date));
    expect(reviewVoteRepository.remove).not.toHaveBeenCalled();
    expect(result).toEqual({ helpfulCount: 3, iVoted: true });
  });

  test('taking the vote back removes it', async () => {
    const result = await reviewVoteService.setHelpful(2, '1', '9', false);
    expect(reviewVoteRepository.remove).toHaveBeenCalledWith(2, 9);
    expect(reviewVoteRepository.add).not.toHaveBeenCalled();
    expect(result.iVoted).toBe(false);
  });
});