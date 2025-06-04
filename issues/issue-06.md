# Implement Bookmark Export to JSON and CSV

**Objective:** Allow users to export all saved bookmarks to disk in JSON or CSV format, for backup or portability.

## Tasks
- [ ] Add "Export" button to standalone window and/or plugin menu.
- [ ] Prompt user to select file path and format using IINA file API.
- [ ] Implement logic to serialize bookmarks to JSON and CSV formats.
- [ ] Ensure exported fields include all metadata (tags, timestamps, descriptions).
- [ ] Handle export errors gracefully and notify the user.

## Acceptance Criteria
- Users can export bookmarks as valid JSON and CSV files.
- Exported data includes full metadata (tags, timestamps, notes).
- Export respects active filters/sorting (if applicable).
- Download location or naming conventions are user-controllable.
