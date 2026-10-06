-- The 20 to 60 character name rule is now enforced by the database too.
ALTER TABLE users  ADD CONSTRAINT chk_users_name_len  CHECK (CHAR_LENGTH(name) BETWEEN 20 AND 60);
ALTER TABLE stores ADD CONSTRAINT chk_stores_name_len CHECK (CHAR_LENGTH(name) BETWEEN 20 AND 60);