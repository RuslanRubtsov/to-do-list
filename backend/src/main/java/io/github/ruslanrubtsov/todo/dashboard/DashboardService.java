package io.github.ruslanrubtsov.todo.dashboard;

import io.github.ruslanrubtsov.todo.api.model.Dashboard;
import io.github.ruslanrubtsov.todo.api.model.DashboardCounts;
import io.github.ruslanrubtsov.todo.api.model.DashboardTask;
import io.github.ruslanrubtsov.todo.api.model.DashboardTodoList;
import io.github.ruslanrubtsov.todo.api.model.Priority;
import io.github.ruslanrubtsov.todo.api.model.Task;
import io.github.ruslanrubtsov.todo.api.model.TodoListRole;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What needs attention across every Todo List the User can access, as of today in the app's time
 * zone. Reads straight from the tables, across Todo Lists, as no single Todo List's Tasks would.
 */
@Service
class DashboardService {

    /** How many Tasks each section lists at most; the counts are of all of them. */
    static final int SECTION_SIZE = 50;

    /** The Tasks of the Todo Lists the User owns or that are Shared with them. */
    private static final String ACCESSIBLE_TASKS = """
            FROM tasks t
            JOIN todo_lists l ON l.id = t.todo_list_id
            LEFT JOIN shares s ON s.todo_list_id = l.id AND s.user_id = :userId
            WHERE (l.owner_id = :userId OR s.user_id IS NOT NULL)
            """;

    private final JdbcClient jdbc;
    private final Clock clock;

    DashboardService(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    Dashboard dashboard(long userId) {
        LocalDate today = LocalDate.now(clock);
        return new Dashboard(
                counts(userId, today),
                openDue(userId, "t.due_date < :today", today),
                openDue(userId, "t.due_date = :today", today),
                openDue(userId, "t.due_date > :today AND t.due_date <= :today + INTERVAL 7 DAY", today));
    }

    private DashboardCounts counts(long userId, LocalDate today) {
        // Completed times are stored in UTC
        LocalDateTime weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .atStartOfDay(clock.getZone())
                .withZoneSameInstant(ZoneOffset.UTC)
                .toLocalDateTime();
        return jdbc.sql("""
                        SELECT COUNT(*) - COUNT(t.completed_at) AS open,
                               COALESCE(SUM(t.completed_at IS NULL AND t.due_date < :today), 0) AS overdue,
                               COALESCE(SUM(t.completed_at IS NULL AND t.due_date = :today), 0) AS dueToday,
                               COALESCE(SUM(t.completed_at >= :weekStart), 0) AS completedThisWeek
                        """ + ACCESSIBLE_TASKS)
                .param("userId", userId)
                .param("today", today)
                .param("weekStart", weekStart)
                .query((rs, row) -> new DashboardCounts(
                        rs.getInt("open"), rs.getInt("overdue"), rs.getInt("dueToday"), rs.getInt("completedThisWeek")))
                .single();
    }

    /** Open Tasks whose Due Date meets the condition: soonest first, then High Priority first. */
    private List<DashboardTask> openDue(long userId, String dueCondition, LocalDate today) {
        return jdbc.sql("""
                        SELECT t.id, t.title, t.description, t.priority, t.due_date, t.version,
                               l.id AS todo_list_id, l.name AS todo_list_name,
                               CASE WHEN l.owner_id = :userId THEN 'OWNER' ELSE s.role END AS role
                        """ + ACCESSIBLE_TASKS + """
                        AND t.completed_at IS NULL AND\s""" + dueCondition + """

                        ORDER BY t.due_date,
                                 CASE t.priority WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
                                 l.name, l.id, t.position, t.id
                        LIMIT :limit
                        """)
                .param("userId", userId)
                .param("today", today)
                .param("limit", SECTION_SIZE)
                .query((rs, row) -> toApi(rs, today))
                .list();
    }

    private static DashboardTask toApi(ResultSet rs, LocalDate today) throws SQLException {
        LocalDate dueDate = rs.getObject("due_date", LocalDate.class);
        Task task = new Task(
                        rs.getLong("id"),
                        rs.getString("title"),
                        Priority.fromValue(rs.getString("priority")),
                        // Open, so Overdue exactly when its Due Date has passed
                        dueDate.isBefore(today),
                        rs.getLong("version"))
                .description(rs.getString("description"))
                .dueDate(dueDate);
        DashboardTodoList todoList = new DashboardTodoList(
                rs.getLong("todo_list_id"),
                rs.getString("todo_list_name"),
                TodoListRole.fromValue(rs.getString("role")));
        return new DashboardTask(task, todoList);
    }
}
