CREATE TABLE todo_lists (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    owner_id   BIGINT       NOT NULL,
    name       VARCHAR(100) NOT NULL,
    created_at DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_todo_lists_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX ix_todo_lists_owner_id_name (owner_id, name)
);

-- Only what a Todo List needs of its Tasks so far: they go with it, and the open ones are counted.
-- The Tasks feature adds the rest of a Task.
CREATE TABLE tasks (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    todo_list_id BIGINT      NOT NULL,
    completed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_tasks_todo_list FOREIGN KEY (todo_list_id) REFERENCES todo_lists (id) ON DELETE CASCADE,
    INDEX ix_tasks_todo_list_id_completed_at (todo_list_id, completed_at)
);
