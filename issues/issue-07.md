# Implement Bookmark Import from JSON and CSV

**Objective:** Let users import bookmark data from a saved JSON or CSV file and merge or replace their current bookmarks.

## Tasks
- [ ] Create an "Import" action in the plugin UI.
- [ ] Validate selected files before parsing.
- [ ] Convert CSV to internal bookmark schema, handling all required fields.
- [ ] Offer merge/replace options to the user before applying.
- [ ] Provide success/failure feedback.

## Acceptance Criteria
- Users can import bookmarks from JSON or CSV without errors.
- Malformed files trigger clear error messages.
- Imported bookmarks appear correctly in all UIs.
- Tags, timestamps, and metadata are preserved.
