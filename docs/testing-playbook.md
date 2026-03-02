# IINA Plugin Bookmarks — Manual Testing Playbook

Use this checklist when testing the plugin in a real IINA environment.

## Environment Setup

1. macOS with IINA installed
2. `make link` in the project root (builds and symlinks the dev plugin)
3. Have 2+ test media files ready (different formats if possible)
4. Restart IINA after installation

## Release Gate (Before Pushing a Release Tag)

1. Run `RELEASE_TAG=vX.Y.Z make release-run` locally (canonical release lane).
2. Optionally run `make release` for a clean-install gate.
3. Complete all P0 tests in this playbook.
4. Follow the tag-based publish checklist in [`.github/RELEASE_RUNBOOK.md`](../.github/RELEASE_RUNBOOK.md) (`v*` tags trigger the Release workflow).

## P0 — Critical Path (Must Pass Before Release)

| ID    | Test                    | Steps                                            | Expected                                                                     |
| ----- | ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| P0-01 | Plugin loads            | Open IINA, check sidebar                         | Plugin tab visible in sidebar                                                |
| P0-02 | Add bookmark            | Play a video, click "Add Bookmark"               | Bookmark appears with auto-generated title containing filename and timestamp |
| P0-03 | Jump to bookmark        | Click on a bookmark entry                        | Video seeks to the bookmark's timestamp                                      |
| P0-04 | Delete bookmark         | Click delete (×) on a bookmark, confirm          | Bookmark removed from list                                                   |
| P0-05 | Persistence             | Add 2 bookmarks, quit IINA, reopen               | Both bookmarks still present                                                 |
| P0-06 | Manage Bookmarks window | Use menu: Manage Bookmarks                       | Standalone window opens showing all bookmarks                                |
| P0-07 | Toggle Overlay          | Use menu: Toggle Bookmarks Overlay               | Overlay appears/disappears over video                                        |
| P0-08 | File-scoped bookmarks   | Add bookmarks to file A and file B, switch files | Only bookmarks for the current file are shown                                |

## P1 — Important Features

| ID    | Test                | Steps                                                     | Expected                                                      |
| ----- | ------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| P1-01 | Text search         | Type in search box                                        | Bookmarks filtered by title/description, matches highlighted  |
| P1-02 | Tag filter          | Add bookmarks with tags, use tag filter                   | Only tagged bookmarks shown                                   |
| P1-03 | Sort by timestamp   | Change sort to timestamp ascending                        | Bookmarks reordered correctly                                 |
| P1-04 | Advanced search     | Enable advanced search, type `tag:work AND title:meeting` | Correct results                                               |
| P1-05 | Add via dialog      | In window view, click Add Bookmark                        | Dialog with title, description, tags fields; saves correctly  |
| P1-06 | Edit bookmark       | In window view, select bookmark, click Edit               | Title, description, tags editable and saved                   |
| P1-07 | Import JSON         | Export, then import the JSON file                         | Round-trip preserves bookmarks; collections import if present |
| P1-08 | Import CSV          | Import a CSV bookmark file                                | Bookmarks created correctly                                   |
| P1-09 | Export JSON         | Click Export, choose JSON                                 | Valid JSON file downloaded                                    |
| P1-10 | Export CSV          | Click Export, choose CSV                                  | Valid CSV file with headers                                   |
| P1-11 | File reconciliation | Move a media file, click Check Files                      | Moved file detected, update path works                        |
| P1-12 | Overlay close       | Click × or press Escape in overlay                        | Overlay hides                                                 |

## P2 — Nice to Have

| ID    | Test                      | Steps                                                                    | Expected                                              |
| ----- | ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| P2-01 | Collections CRUD          | Create/edit/delete a collection; add/remove bookmarks from it            | Collection list and assignments update correctly      |
| P2-02 | Smart collections         | Create a smart collection with filters (for example pinned/tag/date)     | Filtered result set updates as expected               |
| P2-03 | Quick bookmark hotkey     | Use menu/hotkey: Quick Bookmark                                          | Scratchpad bookmark is created; OSD feedback is shown |
| P2-04 | Adjacent navigation       | Use Next/Previous Bookmark hotkeys in a file with multiple bookmarks     | Playback jumps to next/previous bookmark              |
| P2-05 | Range bookmark + A-B loop | Set in/out points, then trigger A-B loop from the created range bookmark | Loop starts and can be cleared                        |
| P2-06 | Resume position           | Play past 5s, switch/reopen same file                                    | Resume position event is offered (unless disabled)    |
| P2-07 | Thumbnail generation      | Trigger thumbnail request from window view for a bookmark                | Thumbnail path is returned and preview appears        |
| P2-08 | Limits & sanitization     | Exceed max bookmarks and add title with HTML/script tags                 | Limit warning shown; unsafe HTML stripped             |

## Regression Notes

- After any persistence change, always verify P0-05.
- After any UI change, check all 3 variants (sidebar, overlay, window).
- After any message handler change, verify CRUD + collection/batch operations.
