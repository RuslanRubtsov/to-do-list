-- The rest of a Task, beyond what its Todo List needed of it: a title, its Priority and Due Date,
-- and when it was added. Until now no Task could be created, so the table is empty.
ALTER TABLE tasks
    ADD COLUMN title      VARCHAR(200) NOT NULL AFTER todo_list_id,
    ADD COLUMN priority   VARCHAR(6)   NOT NULL AFTER title,
    ADD COLUMN due_date   DATE         NULL AFTER priority,
    ADD COLUMN created_at DATETIME(6)  NOT NULL;
