-- Runs once, the first time the container starts with an empty data volume.
-- A second database just for automated tests, so tests can never touch real data.
CREATE DATABASE IF NOT EXISTS store_rating_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON store_rating_test.* TO 'ratehub'@'%';
FLUSH PRIVILEGES;