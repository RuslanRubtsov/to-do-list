-- A Task's optional description. Overdue isn't stored: it is derived from the Due Date on each read.
ALTER TABLE tasks
    ADD COLUMN description VARCHAR(2000) NULL AFTER title;
