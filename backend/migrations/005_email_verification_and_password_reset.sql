ALTER TABLE users
  ADD COLUMN email_verified_at DATETIME NULL AFTER status;

-- Everyone who exists today counts as verified (otherwise admins would be locked out)
UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE status = 'ACTIVE';

-- One row per emailed link. Only a HASH of the token is stored.
CREATE TABLE auth_tokens (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  type       ENUM('EMAIL_VERIFY', 'PASSWORD_RESET') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_auth_tokens_hash (token_hash),
  INDEX idx_auth_tokens_user_type (user_id, type, created_at),
  INDEX idx_auth_tokens_expires (expires_at)
) ENGINE=InnoDB;