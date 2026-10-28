package io.github.ruslanrubtsov.todo.todolists;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A Todo List: a named collection of Tasks with exactly one Owner. */
@Entity
@Table(name = "todo_lists")
class TodoListEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(updatable = false)
    private long ownerId;

    private String name;

    @Column(updatable = false)
    private Instant createdAt;

    protected TodoListEntity() {}

    TodoListEntity(long ownerId, String name) {
        this.ownerId = ownerId;
        this.name = name.strip();
        this.createdAt = Instant.now();
    }

    Long getId() {
        return id;
    }

    String getName() {
        return name;
    }

    void rename(String name) {
        this.name = name.strip();
    }
}
