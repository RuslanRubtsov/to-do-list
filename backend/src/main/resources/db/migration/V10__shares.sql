-- A Share gives one User other than the Owner the role of Viewer or Editor on a Todo List. It goes
-- with the Todo List and with the User.
CREATE TABLE shares (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    todo_list_id BIGINT      NOT NULL,
    user_id      BIGINT      NOT NULL,
    role         VARCHAR(6)  NOT NULL,
    created_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_shares_todo_list_id_user_id UNIQUE (todo_list_id, user_id),
    CONSTRAINT fk_shares_todo_list FOREIGN KEY (todo_list_id) REFERENCES todo_lists (id) ON DELETE CASCADE,
    CONSTRAINT fk_shares_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    -- The Todo Lists Shared with a User
    INDEX ix_shares_user_id (user_id)
);
