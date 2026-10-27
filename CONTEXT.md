# To-Do

Users organise their work into named lists of tasks and track each task through to completion.

## Language

**User**:
A person with an account. A User sees only the Todo Lists they own or that have been shared with them.
_Avoid_: Account, member, customer

**Todo List**:
A named collection of Tasks with exactly one Owner (e.g. "Work", "Groceries").
_Avoid_: List (on its own), project, board, folder

### Sharing

**Share**:
A grant by an Owner that gives one other registered User the role of Viewer or Editor on a Todo List. It takes effect immediately, and the Owner can revoke it or the User can leave it.
_Avoid_: Invitation, membership, permission

**Owner**:
The User who created a Todo List. Every Todo List has exactly one Owner.
_Avoid_: Creator, admin, author

**Viewer**:
A User other than the Owner who has been given read-only access to a Todo List.
_Avoid_: Reader, guest, follower

**Editor**:
A User other than the Owner who has been given access to change a Todo List's Tasks.
_Avoid_: Contributor, collaborator, writer

### Tasks

**Task**:
A single piece of work inside exactly one Todo List.
_Avoid_: Todo, item, ticket, note

**Completed**:
The state of a Task that its Owner or an Editor has marked as done. A Task is either completed or not; there are no intermediate states.
_Avoid_: Done, closed, finished, resolved

**Due Date**:
The optional date by which a Task should be completed.
_Avoid_: Deadline, due time

**Overdue**:
The state of a Task whose Due Date has passed while it is not Completed. Always derived, never set by hand.
_Avoid_: Late, expired, past due

**Priority**:
How important a Task is relative to others: Low, Medium or High.
_Avoid_: Importance, severity, urgency
