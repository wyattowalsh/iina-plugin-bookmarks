# Add Support for Bookmark Tags

**Objective:** Enable users to assign, edit, and filter bookmarks using tags for better organization and retrieval.

## Tasks
- [ ] Extend bookmark data model to support tag arrays.
- [ ] Update `BookmarkData` interface (likely in `src/global.ts` or a shared types file) to include a `tags?: string[]` field to store an array of tag strings.
- [ ] Provide tag input UI (e.g. chips or comma-separated field).
- [ ] Render tags in all bookmark displays.
- [ ] Enable tag-based filtering and search.
- [ ] Write tests to validate tag parsing and rendering.

## Acceptance Criteria
- Tags are stored and rendered correctly across all views.
- Filtering/search by tag is supported.
- UI supports adding/editing tags efficiently.
