-- For querying a Todo List's Tasks by Due Date and by Priority, as filters or as orders.
CREATE INDEX ix_tasks_todo_list_id_due_date ON tasks (todo_list_id, due_date);
CREATE INDEX ix_tasks_todo_list_id_priority ON tasks (todo_list_id, priority);
