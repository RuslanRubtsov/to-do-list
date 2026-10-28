-- Refresh tokens rotate: each refresh replaces the token with a new one in the same family, the
-- chain of tokens descended from one login. Replaying a rotated token revokes its whole family.
ALTER TABLE refresh_tokens
    ADD COLUMN family_id  CHAR(36)    NULL AFTER user_id,
    ADD COLUMN rotated_at DATETIME(6) NULL AFTER expires_at;

-- Tokens issued before rotation each started a family of their own
UPDATE refresh_tokens SET family_id = UUID();

ALTER TABLE refresh_tokens
    MODIFY COLUMN family_id CHAR(36) NOT NULL,
    ADD INDEX ix_refresh_tokens_family_id (family_id);
