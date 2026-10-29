package io.github.ruslanrubtsov.todo.sharing;

import static io.github.ruslanrubtsov.todo.web.error.Problems.invalidField;

import io.github.ruslanrubtsov.todo.api.model.Share;
import io.github.ruslanrubtsov.todo.api.model.ShareDraft;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess.Action;
import io.github.ruslanrubtsov.todo.users.UserEntity;
import io.github.ruslanrubtsov.todo.users.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class SharingService {

    private final ShareRepository shares;
    private final UserRepository users;
    private final TodoListAccess access;

    SharingService(ShareRepository shares, UserRepository users, TodoListAccess access) {
        this.shares = shares;
        this.users = users;
        this.access = access;
    }

    /**
     * Shares the Todo List with the registered User who has the email. Refuses an email no User has,
     * the Owner's own, and one of a User the Todo List is already Shared with.
     */
    @Transactional
    Share create(long userId, long todoListId, ShareDraft draft) {
        // One Share at a time, so that two of the same User can't both pass the check below
        access.lock(userId, todoListId, Action.SHARE);
        UserEntity recipient = users.findByEmail(UserEntity.normalizeEmail(draft.getEmail()))
                .orElseThrow(() -> invalidField("email", "NOT_REGISTERED"));
        // Only the Owner Shares, so this is their own email
        if (recipient.getId() == userId) throw invalidField("email", "OWNER");
        if (shares.existsByTodoListIdAndUserId(todoListId, recipient.getId())) {
            throw invalidField("email", "ALREADY_SHARED");
        }
        ShareEntity share = shares.save(new ShareEntity(todoListId, recipient.getId(), draft.getRole()));
        return new Share(recipient.getId(), recipient.getEmail(), recipient.getDisplayName(), share.getRole());
    }
}
