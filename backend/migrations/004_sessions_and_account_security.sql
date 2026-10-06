-- Account security columns. Existing users become ACTIVE automatically.
ALTER TABLE users
  ADD COLUMN status ENUM('ACTIVE', 'PENDING', 'SUSPENDED', 'DEACTIVATED') NOT NULL DEFAULT 'ACTIVE' AFTER role,
  ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN locked_until DATETIME NULL,
  ADD COLUMN last_login_at DATETIME NULL,
  ADD COLUMN password_changed_at DATETIME NULL,
  ADD INDEX idx_users_status (status);

-- One row per refresh token. We store only a HASH of the token, never the token itself.
-- All tokens created by rotating one login share a family_id (= one "session" / device).
CREATE TABLE refresh_tokens (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT          NOT NULL,
  family_id      CHAR(36)     NOT NULL,
  token_hash     CHAR(64)     NOT NULL,
  expires_at     DATETIME     NOT NULL,
  revoked_at     DATETIME     NULL,
  revoked_reason VARCHAR(20)  NULL,
  ip_address     VARCHAR(45)  NULL,
  user_agent     VARCHAR(255) NULL,
  created_at     DATETIME     NOT NULL,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_refresh_hash (token_hash),
  INDEX idx_refresh_user (user_id, revoked_at),
  INDEX idx_refresh_family (family_id),
  INDEX idx_refresh_expires (expires_at)
) ENGINE=InnoDB;