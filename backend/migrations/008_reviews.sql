ALTER TABLE ratings
  ADD COLUMN review_text TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER rating,
  ADD COLUMN reviewed_at DATETIME NULL AFTER review_text,
  ADD COLUMN review_edited_at DATETIME NULL AFTER reviewed_at;

ALTER TABLE ratings
  ADD CONSTRAINT chk_review_text_len
    CHECK (review_text IS NULL OR CHAR_LENGTH(review_text) BETWEEN 10 AND 1000),
  ADD CONSTRAINT chk_review_dates
    CHECK ((review_text IS NULL) = (reviewed_at IS NULL)),
  ADD INDEX idx_ratings_store_reviewed (store_id, reviewed_at),
  ADD INDEX idx_ratings_store_rating (store_id, rating);