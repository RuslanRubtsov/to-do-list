# Demo data

`docker compose up` runs the backend with the `demo` profile, which seeds two demo Users into an
empty database, so the app looks alive from the first start. Tests never load it: only the `demo`
profile adds its migration location, `backend/src/main/resources/db/demo`.

## Demo credentials

| User  | Email               | Password      | Language  |
|-------|---------------------|---------------|-----------|
| Olena | `olena@example.com` | `todo-demo-1` | English   |
| Taras | `taras@example.com` | `todo-demo-1` | Ukrainian |

Log in as each in two browser windows to see sharing at work.

## What is seeded

| Todo List    | Owner | Shared with                      |
|--------------|-------|----------------------------------|
| Groceries    | Olena | Taras, as an Editor              |
| Work         | Olena | no one                           |
| Trip to Lviv | Olena | Taras, as a Viewer               |
| Home repairs | Taras | Olena, as an Editor              |
| Garden       | Taras | Olena, as a Viewer               |

Their Tasks are Overdue, due today, due in the next few days or Completed, relative to the day the
data was seeded, so both Users' dashboards have something in every section. Days later, more of
them are Overdue: the dates don't move.

## Seeding again

The data is seeded only into a database without the demo Users. To seed afresh, with dates
relative to today, start from an empty database:

```sh
docker compose down --volumes
docker compose up
```
