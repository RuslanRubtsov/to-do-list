package io.github.ruslanrubtsov.todo.sharing;

import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** A Share: an Owner's grant to one other User of the role of Viewer or Editor on a Todo List. */
@Entity
@Table(name = "shares")
class ShareEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(updatable = false)
    private long todoListId;

    @Column(updatable = false)
    private long userId;

    @Enumerated(EnumType.STRING)
    private ShareRole role;

    @Column(updatable = false)
    private Instant createdAt;

    protected ShareEntity() {}

    ShareEntity(long todoListId, long userId, ShareRole role) {
        this.todoListId = todoListId;
        this.userId = userId;
        this.role = role;
        this.createdAt = Instant.now();
    }

    ShareRole getRole() {
        return role;
    }
}
