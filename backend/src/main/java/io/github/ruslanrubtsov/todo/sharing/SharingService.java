package io.github.ruslanrubtsov.todo.sharing;

import static io.github.ruslanrubtsov.todo.web.error.Problems.invalidField;
import static io.github.ruslanrubtsov.todo.web.error.Problems.problem;

import io.github.ruslanrubtsov.todo.api.model.ErrorCode;
import io.github.ruslanrubtsov.todo.api.model.Share;
import io.github.ruslanrubtsov.todo.api.model.ShareDraft;
import io.github.ruslanrubtsov.todo.api.model.ShareRole;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess;
import io.github.ruslanrubtsov.todo.todolists.TodoListAccess.Action;
import io.github.ruslanrubtsov.todo.users.UserEntity;
import io.github.ruslanrubtsov.todo.users.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
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
        return toApi(share, recipient);
    }

    /** Whom the Todo List is Shared with, by display name. */
    @Transactional(readOnly = true)
    List<Share> list(long userId, long todoListId) {
        access.require(userId, todoListId, Action.SHARE);
        return shares.findSummaries(todoListId).stream()
                .map(share -> new Share(
                        share.getUserId(),
                        share.getEmail(),
                        share.getDisplayName(),
                        ShareRole.fromValue(share.getRole())))
                .toList();
    }

    @Transactional
    Share changeRole(long userId, long todoListId, long sharedWithId, ShareRole role) {
        access.require(userId, todoListId, Action.SHARE);
        ShareEntity share = existing(todoListId, sharedWithId);
        share.changeRole(role);
        return toApi(share, users.findById(sharedWithId).orElseThrow());
    }

    /** With immediate effect: the User no longer reaches the Todo List. */
    @Transactional
    void revoke(long userId, long todoListId, long sharedWithId) {
        access.require(userId, todoListId, Action.SHARE);
        shares.delete(existing(todoListId, sharedWithId));
    }

    /** Ends the User's own Share of the Todo List. */
    @Transactional
    void leave(long userId, long todoListId) {
        access.require(userId, todoListId, Action.LEAVE);
        shares.delete(existing(todoListId, userId));
    }

    private ShareEntity existing(long todoListId, long sharedWithId) {
        return shares.findByTodoListIdAndUserId(todoListId, sharedWithId)
                .orElseThrow(() -> problem(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such Share."));
    }

    private static Share toApi(ShareEntity share, UserEntity user) {
        return new Share(user.getId(), user.getEmail(), user.getDisplayName(), share.getRole());
    }
}
