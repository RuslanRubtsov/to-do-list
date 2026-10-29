-- Demo data for the demo profile only: Olena and Taras, each with Todo Lists of their own, Shared
-- with the other both as a Viewer and as an Editor, and Tasks Overdue, due today, upcoming and
-- Completed relative to the day it is seeded (${demoToday}).
--
-- Both log in with the password todo-demo-1. Olena prefers English, Taras Ukrainian.
--
-- Repeatable, so that it runs after the schema migrations, but seeded only once: if the demo Users
-- exist already, nothing changes. Today's date makes its checksum change daily, so Flyway may run it
-- again on a new day, changing nothing. To seed again, start from an empty database.

SET @seed = NOT EXISTS (SELECT 1 FROM users WHERE email = 'olena@example.com');
SET @today = DATE '${demoToday}';
-- Completed times are stored in UTC. The Completed Tasks are Completed at the moment of seeding, so
-- that they count as Completed this week whenever that is.
SET @now = UTC_TIMESTAMP(6);

-- BCrypt hash of todo-demo-1
INSERT INTO users (email, password_hash, display_name, preferred_language, created_at)
SELECT email, '$2a$10$Kn7QUXrpK1CPTgqpm9oYVu4KzhU0.vkj6Mk0XAcBvejEcNqW9W0ru', display_name,
       preferred_language, @now - INTERVAL 30 DAY
FROM (SELECT 'olena@example.com' AS email, 'Olena' AS display_name, 'en' AS preferred_language
      UNION ALL SELECT 'taras@example.com', 'Taras', 'uk') AS demo_users
WHERE @seed;

SET @olena = (SELECT id FROM users WHERE email = 'olena@example.com');
SET @taras = (SELECT id FROM users WHERE email = 'taras@example.com');

-- Olena's Todo Lists
INSERT INTO todo_lists (owner_id, name, version, created_at)
SELECT @olena, 'Groceries', 0, @now - INTERVAL 20 DAY FROM DUAL WHERE @seed;
SET @groceries = LAST_INSERT_ID();
INSERT INTO todo_lists (owner_id, name, version, created_at)
SELECT @olena, 'Work', 0, @now - INTERVAL 19 DAY FROM DUAL WHERE @seed;
SET @work = LAST_INSERT_ID();
INSERT INTO todo_lists (owner_id, name, version, created_at)
SELECT @olena, 'Trip to Lviv', 0, @now - INTERVAL 10 DAY FROM DUAL WHERE @seed;
SET @trip = LAST_INSERT_ID();

-- Taras's Todo Lists
INSERT INTO todo_lists (owner_id, name, version, created_at)
SELECT @taras, 'Home repairs', 0, @now - INTERVAL 18 DAY FROM DUAL WHERE @seed;
SET @repairs = LAST_INSERT_ID();
INSERT INTO todo_lists (owner_id, name, version, created_at)
SELECT @taras, 'Garden', 0, @now - INTERVAL 15 DAY FROM DUAL WHERE @seed;
SET @garden = LAST_INSERT_ID();

-- Shared both ways, in both roles
INSERT INTO shares (todo_list_id, user_id, role, created_at)
SELECT todo_list_id, user_id, role, @now - INTERVAL 9 DAY
FROM (SELECT @groceries AS todo_list_id, @taras AS user_id, 'EDITOR' AS role
      UNION ALL SELECT @trip, @taras, 'VIEWER'
      UNION ALL SELECT @repairs, @olena, 'EDITOR'
      UNION ALL SELECT @garden, @olena, 'VIEWER') AS demo_shares
WHERE @seed;

-- Tasks, in their manual order: positions 1024 apart, as Tasks added one by one get them
INSERT INTO tasks (todo_list_id, title, description, priority, due_date, completed_at, position,
                   version, created_at)
SELECT todo_list_id, title, description, priority, due_date, completed_at, position, 0,
       @now - INTERVAL 8 DAY
FROM (
    SELECT @groceries AS todo_list_id, 'Buy milk' AS title, NULL AS description,
           'MEDIUM' AS priority, @today AS due_date, NULL AS completed_at, 1024 AS position
    UNION ALL SELECT @groceries, 'Buy bread', NULL, 'LOW', @today, NULL, 2048
    UNION ALL SELECT @groceries, 'Pick up the birthday cake', 'Order 1042: chocolate, no nuts.',
                     'HIGH', @today + INTERVAL 2 DAY, NULL, 3072
    UNION ALL SELECT @groceries, 'Restock olive oil', NULL, 'MEDIUM', @today - INTERVAL 2 DAY,
                     NULL, 4096
    UNION ALL SELECT @groceries, 'Buy coffee beans', NULL, 'LOW', NULL, @now, 5120

    UNION ALL SELECT @work, 'Prepare the quarterly report', 'Numbers from finance, charts from the dashboard.',
                     'HIGH', @today - INTERVAL 1 DAY, NULL, 1024
    UNION ALL SELECT @work, 'Review Taras''s pull request', NULL, 'MEDIUM', @today, NULL, 2048
    UNION ALL SELECT @work, 'Book a meeting room', NULL, 'LOW', @today + INTERVAL 4 DAY, NULL, 3072
    UNION ALL SELECT @work, 'Plan the next sprint', NULL, 'MEDIUM', @today + INTERVAL 6 DAY, NULL, 4096
    UNION ALL SELECT @work, 'Send the invoices', NULL, 'HIGH', @today - INTERVAL 1 DAY,
                     @now, 5120

    UNION ALL SELECT @trip, 'Book train tickets', 'The Intercity, in the morning.', 'HIGH',
                     @today + INTERVAL 1 DAY, NULL, 1024
    UNION ALL SELECT @trip, 'Reserve a hotel', 'Near the Market Square.', 'HIGH',
                     @today + INTERVAL 3 DAY, NULL, 2048
    UNION ALL SELECT @trip, 'List cafés to visit', NULL, 'LOW', NULL, NULL, 3072
    UNION ALL SELECT @trip, 'Renew the travel insurance', NULL, 'MEDIUM', NULL,
                     @now, 4096

    UNION ALL SELECT @repairs, 'Fix the leaking tap', 'The kitchen one. Washers are in the toolbox.',
                     'HIGH', @today - INTERVAL 3 DAY, NULL, 1024
    UNION ALL SELECT @repairs, 'Replace the hallway bulb', NULL, 'LOW', @today, NULL, 2048
    UNION ALL SELECT @repairs, 'Paint the balcony door', NULL, 'MEDIUM', @today + INTERVAL 5 DAY,
                     NULL, 3072
    UNION ALL SELECT @repairs, 'Buy a drill bit set', NULL, 'LOW', NULL, @now, 4096

    UNION ALL SELECT @garden, 'Water the tomatoes', NULL, 'MEDIUM', @today, NULL, 1024
    UNION ALL SELECT @garden, 'Prune the apple tree', NULL, 'MEDIUM', @today + INTERVAL 2 DAY, NULL, 2048
    UNION ALL SELECT @garden, 'Mow the lawn', NULL, 'LOW', @today - INTERVAL 1 DAY, NULL, 3072
    UNION ALL SELECT @garden, 'Plant tulip bulbs', NULL, 'HIGH', NULL, @now, 4096
) AS demo_tasks
WHERE @seed;
