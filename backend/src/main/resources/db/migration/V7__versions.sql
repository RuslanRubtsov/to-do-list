-- Optimistic locking: each change to a Todo List or Task makes a new version, and a change based
-- on an older one is refused.
ALTER TABLE todo_lists ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER name;
ALTER TABLE tasks ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER completed_at;
