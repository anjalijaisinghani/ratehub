const toBool = (v) => Number(v) === 1;

// The owner's reply to a review, or null when there is none.
// It never includes who the owner is: only "the owner" replied.
const toReply = (text, repliedAt, editedAt) =>
  text ? { text, repliedAt, editedAt: editedAt ?? null } : null;

// A row from the public review list -> JSON. Note: no email, no address, no user id.
const toReview = (r) => ({
  id: r.id,
  rating: r.rating,
  text: r.text,
  reviewedAt: r.reviewedAt,
  editedAt: r.editedAt ?? null,
  reviewerName: r.reviewerName,
  isMine: toBool(r.isMine),
  helpfulCount: Number(r.helpfulCount) || 0,
  iVoted: toBool(r.iVoted),
  reply: toReply(r.replyText, r.repliedAt, r.replyEditedAt),
});

// A row from the owner's "reviews of my store" list
const toOwnerReview = (r) => ({
  id: r.id,
  rating: r.rating,
  text: r.text,
  reviewedAt: r.reviewedAt,
  editedAt: r.editedAt ?? null,
  reviewerName: r.reviewerName,
  storeName: r.storeName,
  helpfulCount: Number(r.helpfulCount) || 0,
  reply: toReply(r.replyText, r.repliedAt, r.replyEditedAt),
});

// The logged-in user's own row from the ratings table (raw column names)
const toMyReview = (r) => ({
  id: r.id,
  rating: r.rating,
  text: r.review_text,
  reviewedAt: r.reviewed_at,
  editedAt: r.review_edited_at ?? null,
  helpfulCount: Number(r.helpful_count) || 0,
  reply: toReply(r.reply_text, r.replied_at, r.reply_edited_at),
});

// Every star value 1..5 must appear, even with 0 votes
const buildDistribution = (rows) =>
  [1, 2, 3, 4, 5].map((star) => {
    const found = rows.find((r) => r.rating === star);
    return { rating: star, count: found ? Number(found.count) : 0 };
  });

module.exports = { toReview, toOwnerReview, toMyReview, buildDistribution };