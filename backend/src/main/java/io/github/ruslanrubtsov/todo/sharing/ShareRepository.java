package io.github.ruslanrubtsov.todo.sharing;

import org.springframework.data.jpa.repository.JpaRepository;

interface ShareRepository extends JpaRepository<ShareEntity, Long> {

    boolean existsByTodoListIdAndUserId(long todoListId, long userId);
}
