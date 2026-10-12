-- Owner replies: three columns on the same row as the review
ALTER TABLE ratings
  ADD COLUMN reply_text TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER review_edited_at,
  ADD COLUMN replied_at DATETIME NULL AFTER reply_text,
  ADD COLUMN reply_edited_at DATETIME NULL AFTER replied_at;

ALTER TABLE ratings
  ADD CONSTRAINT chk_reply_text_len
    CHECK (reply_text IS NULL OR CHAR_LENGTH(reply_text) BETWEEN 5 AND 1000),
  ADD CONSTRAINT chk_reply_dates
    CHECK ((reply_text IS NULL) = (replied_at IS NULL)),
  ADD CONSTRAINT chk_reply_needs_review
    CHECK (reply_text IS NULL OR review_text IS NOT NULL);

-- Helpful votes: one row per (review, voter)
CREATE TABLE review_votes (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  rating_id  INT NOT NULL,
  user_id    INT NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_votes_rating FOREIGN KEY (rating_id) REFERENCES ratings(id) ON DELETE CASCADE,
  CONSTRAINT fk_votes_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  UNIQUE KEY uq_votes_rating_user (rating_id, user_id),
  INDEX idx_votes_user (user_id)
) ENGINE=InnoDB;

-- Verified stores: who verified, and when. NULL = not verified.
ALTER TABLE stores
  ADD COLUMN verified_at DATETIME NULL,
  ADD COLUMN verified_by INT NULL,
  ADD CONSTRAINT fk_stores_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD INDEX idx_stores_verified (verified_at);