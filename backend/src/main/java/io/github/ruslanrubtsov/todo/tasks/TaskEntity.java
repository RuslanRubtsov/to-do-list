package io.github.ruslanrubtsov.todo.tasks;

import io.github.ruslanrubtsov.todo.api.model.Priority;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** A Task: a single piece of work inside exactly one Todo List. */
@Entity
@Table(name = "tasks")
class TaskEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(updatable = false)
    private long todoListId;

    private String title;

    private String description;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private LocalDate dueDate;

    private Instant completedAt;

    @Version
    private long version;

    @Column(updatable = false)
    private Instant createdAt;

    protected TaskEntity() {}

    /** A new open Task, with Medium Priority and no Due Date. */
    TaskEntity(long todoListId, String title) {
        this.todoListId = todoListId;
        this.title = title.strip();
        this.priority = Priority.MEDIUM;
        this.createdAt = Instant.now();
    }

    Long getId() {
        return id;
    }

    String getTitle() {
        return title;
    }

    String getDescription() {
        return description;
    }

    Priority getPriority() {
        return priority;
    }

    LocalDate getDueDate() {
        return dueDate;
    }

    Instant getCompletedAt() {
        return completedAt;
    }

    long getVersion() {
        return version;
    }

    /** Whether its Due Date passed before {@code today} while it isn't Completed. */
    boolean isOverdueOn(LocalDate today) {
        return completedAt == null && dueDate != null && dueDate.isBefore(today);
    }

    /** Replaces its details; a blank description is none. */
    void change(String title, String description, LocalDate dueDate, Priority priority) {
        this.title = title.strip();
        this.description = description == null || description.isBlank() ? null : description.strip();
        this.dueDate = dueDate;
        this.priority = priority;
    }

    /** Completed now, unless it already was: then it keeps the time it was first Completed. */
    void complete() {
        // To the microsecond, as the database keeps it
        if (completedAt == null) completedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    void uncomplete() {
        completedAt = null;
    }
}
