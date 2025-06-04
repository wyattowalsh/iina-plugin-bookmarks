# Implement Metadata Auto-Population for New Bookmarks

**Objective:** Automatically generate default bookmark titles or descriptions based on metadata (e.g. file name, track title).

## Tasks
- [ ] Detect current media title using IINA metadata APIs.
- [ ] Define fallback behavior (e.g. use filename if no title).
- [ ] Apply default title/description when opening add-bookmark dialog.
- [ ] Allow user to override defaults before saving.

## Acceptance Criteria
- Metadata-based defaults are correctly populated and editable.
- Fallbacks behave consistently across formats and missing metadata.
