-- Each Task's place in its Todo List's manual order. Sparse, so that most moves change only the moved
-- Task. Tasks that already exist keep the order they were added in.
ALTER TABLE tasks ADD COLUMN position BIGINT NULL AFTER completed_at;
UPDATE tasks SET position = id * 1024;
ALTER TABLE tasks MODIFY position BIGINT NOT NULL;
CREATE INDEX ix_tasks_todo_list_id_position ON tasks (todo_list_id, position);
