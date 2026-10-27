CREATE TABLE users (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    -- Stored lower-cased, so the unique key ignores letter case. Binary collation: the default one
    -- also ignores accents, which would make josé@ and jose@ the same email.
    email              VARCHAR(254) NOT NULL COLLATE utf8mb4_bin,
    password_hash      VARCHAR(100) NOT NULL,
    display_name       VARCHAR(100) NOT NULL,
    preferred_language VARCHAR(8)   NOT NULL,
    created_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);

-- Only a hash of each refresh token is kept, so a leaked table can't be replayed
CREATE TABLE refresh_tokens (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    token_hash CHAR(64)    NOT NULL,
    created_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_refresh_tokens_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
