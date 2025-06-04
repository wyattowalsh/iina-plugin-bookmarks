# Enable Drag-and-Drop Bookmark Reordering

**Objective:** Let users manually reorder bookmarks in the standalone window or sidebar using drag-and-drop.

## Tasks
- [ ] Add drag handles or drag zones to each bookmark item.
- [ ] Implement reordering logic using HTML5 drag-and-drop or a lightweight library.
- [ ] Update underlying bookmark order and persist changes.
- [ ] Ensure smooth interaction across different screen sizes.
- [ ] Define and implement behavior for drag-and-drop when sorting is active (e.g., disable drag, drag overrides sort temporarily, or re-apply sort after drag).
- [ ] Write tests for drag behavior and state update logic.

## Acceptance Criteria
- Drag-and-drop works in standalone and sidebar UIs.
- New order persists across sessions.
- UI gives feedback during drag events.
- Interaction between drag-and-drop and sorting is clearly defined and implemented.
