# Support Markdown/Rich Text in Bookmark Descriptions

**Objective:** Allow users to use markdown syntax to format descriptions (e.g., bold, italics, links, lists).

## Tasks
- [ ] Add markdown rendering support (e.g. via Showdown.js or Marked).
- [ ] Sanitize rendered HTML to prevent XSS.
- [ ] Provide basic styling for markdown elements.
- [ ] Test rendering with various markdown inputs.

## Acceptance Criteria
- Markdown syntax is rendered in descriptions.
- Plugin UI prevents HTML injection and unsafe rendering.
- Formatting works in overlay, sidebar, and standalone views.
