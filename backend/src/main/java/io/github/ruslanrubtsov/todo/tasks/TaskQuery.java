package io.github.ruslanrubtsov.todo.tasks;

import io.github.ruslanrubtsov.todo.api.model.Priority;
import io.github.ruslanrubtsov.todo.api.model.TaskSort;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.data.jpa.domain.Specification;

/**
 * What a query for a Todo List's Tasks asks for: filters, each left out when {@code null} or empty, all
 * of which a Task must match, and the order to list them in.
 */
record TaskQuery(
        @Nullable Boolean completed,
        List<Priority> priorities,
        @Nullable LocalDate dueFrom,
        @Nullable LocalDate dueTo,
        @Nullable Boolean overdue,
        @Nullable String text,
        TaskSort sort) {

    /** Escapes the wildcards of a {@code LIKE} pattern; not a backslash, which MySQL reads in literals. */
    private static final char ESCAPE = '!';

    /**
     * The Tasks of this Todo List, and no other, that match the query as of {@code today}, in the order
     * asked for. Tasks that tie keep their manual order, so that paging through them is stable.
     */
    Specification<TaskEntity> inTodoList(long todoListId, LocalDate today) {
        return (root, query, cb) -> {
            // A count needs no order, and some databases refuse one
            if (query != null && !isCount(query.getResultType())) query.orderBy(order(root, cb));
            return cb.and(filters(todoListId, today, root, cb).toArray(Predicate[]::new));
        };
    }

    private List<Predicate> filters(long todoListId, LocalDate today, Root<TaskEntity> root, CriteriaBuilder cb) {
        Path<Instant> completedAt = root.get("completedAt");
        Path<LocalDate> dueDate = root.get("dueDate");
        List<Predicate> filters = new ArrayList<>();
        filters.add(cb.equal(root.get("todoListId"), todoListId));
        if (completed != null) filters.add(completed ? cb.isNotNull(completedAt) : cb.isNull(completedAt));
        if (!priorities.isEmpty()) filters.add(root.get("priority").in(priorities));
        if (dueFrom != null) filters.add(cb.greaterThanOrEqualTo(dueDate, dueFrom));
        if (dueTo != null) filters.add(cb.lessThanOrEqualTo(dueDate, dueTo));
        if (overdue != null) {
            // As TaskEntity.isOverdueOn reckons it. Spelled out both ways, as negating a comparison
            // with a missing Due Date would leave out Tasks that have none.
            filters.add(
                    overdue
                            ? cb.and(cb.isNull(completedAt), cb.lessThan(dueDate, today))
                            : cb.or(
                                    cb.isNotNull(completedAt),
                                    cb.isNull(dueDate),
                                    cb.greaterThanOrEqualTo(dueDate, today)));
        }
        if (text != null && !text.isBlank()) {
            String pattern = "%" + escapeWildcards(text.strip().toLowerCase()) + "%";
            filters.add(cb.or(
                    cb.like(cb.lower(root.get("title")), pattern, ESCAPE),
                    cb.like(cb.lower(root.get("description")), pattern, ESCAPE)));
        }
        return filters;
    }

    private List<Order> order(Root<TaskEntity> root, CriteriaBuilder cb) {
        Path<LocalDate> dueDate = root.get("dueDate");
        List<Order> order = new ArrayList<>();
        switch (sort) {
            case POSITION -> {}
            case DUE_DATE -> {
                // Those with none last
                order.add(cb.asc(cb.selectCase().when(cb.isNull(dueDate), 1).otherwise(0)));
                order.add(cb.asc(dueDate));
            }
            case PRIORITY -> order.add(cb.asc(rank(root.get("priority"), cb)));
            case TITLE -> order.add(cb.asc(root.get("title")));
            case CREATED -> {
                // Newest first, and of those added at once the last added
                order.add(cb.desc(root.get("createdAt")));
                order.add(cb.desc(root.get("id")));
            }
        }
        order.add(cb.asc(root.get("position")));
        order.add(cb.asc(root.get("id")));
        return order;
    }

    /** High first: the Priorities are stored by name, which wouldn't sort that way. */
    private static Expression<Object> rank(Path<Priority> priority, CriteriaBuilder cb) {
        return cb.selectCase()
                .when(cb.equal(priority, Priority.HIGH), 0)
                .when(cb.equal(priority, Priority.MEDIUM), 1)
                .otherwise(2);
    }

    private static String escapeWildcards(String text) {
        return text.replace("" + ESCAPE, "" + ESCAPE + ESCAPE)
                .replace("%", ESCAPE + "%")
                .replace("_", ESCAPE + "_");
    }

    private static boolean isCount(Class<?> resultType) {
        return resultType == Long.class || resultType == long.class;
    }
}
