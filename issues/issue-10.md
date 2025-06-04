# Implement Undo and Redo Functionality for Bookmark Actions

**Objective:** Add undo/redo capability for create, edit, and delete bookmark operations.

## Tasks
- [ ] Maintain a history stack of recent bookmark operations.
- [ ] Add undo and redo commands (UI buttons or shortcuts).
- [ ] Ensure state rollbacks properly reflect across all views.
- [ ] Limit stack size or implement history pruning.
- [ ] Write tests to validate correctness of state transitions.

## Acceptance Criteria
- Undo/redo works for add/edit/delete operations.
- Users can reverse actions with keyboard or UI buttons.
- States are persisted in memory per session.
