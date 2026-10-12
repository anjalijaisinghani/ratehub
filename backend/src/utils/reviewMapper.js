const toBool = (v) => Number(v) === 1;

// A row from the review list -> JSON. Note: no email, no address, no user id.
const toReview = (r) => ({
  id: r.id,
  rating: r.rating,
  text: r.text,
  reviewedAt: r.reviewedAt,
  editedAt: r.editedAt ?? null,
  reviewerName: r.reviewerName,
  isMine: toBool(r.isMine),
});

// The logged-in user's own row from the ratings table (raw column names)
const toMyReview = (r) => ({
  id: r.id,
  rating: r.rating,
  text: r.review_text,
  reviewedAt: r.reviewed_at,
  editedAt: r.review_edited_at ?? null,
});

// Every star value 1..5 must appear, even with 0 votes
const buildDistribution = (rows) =>
  [1, 2, 3, 4, 5].map((star) => {
    const found = rows.find((r) => r.rating === star);
    return { rating: star, count: found ? Number(found.count) : 0 };
  });

module.exports = { toReview, toMyReview, buildDistribution };