# IINA Plugin Bookmarks — Manual Testing Playbook

Use this checklist when testing the plugin in a real IINA environment.

## Environment Setup

1. macOS with IINA installed
2. `make build` in the project root
3. Symlink the plugin: `ln -sf "$(pwd)/dist" ~/Library/Application\ Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin`
4. Have 2+ test media files ready (different formats if possible)
5. Restart IINA after installation

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

| ID    | Test                | Steps                                                     | Expected                                                     |
| ----- | ------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| P1-01 | Text search         | Type in search box                                        | Bookmarks filtered by title/description, matches highlighted |
| P1-02 | Tag filter          | Add bookmarks with tags, use tag filter                   | Only tagged bookmarks shown                                  |
| P1-03 | Sort by timestamp   | Change sort to timestamp ascending                        | Bookmarks reordered correctly                                |
| P1-04 | Advanced search     | Enable advanced search, type `tag:work AND title:meeting` | Correct results                                              |
| P1-05 | Add via dialog      | In window view, click Add Bookmark                        | Dialog with title, description, tags fields; saves correctly |
| P1-06 | Edit bookmark       | In window view, select bookmark, click Edit               | Title, description, tags editable and saved                  |
| P1-07 | Import JSON         | Export, then import the JSON file                         | Round-trip preserves all data                                |
| P1-08 | Import CSV          | Import a CSV bookmark file                                | Bookmarks created correctly                                  |
| P1-09 | Export JSON         | Click Export, choose JSON                                 | Valid JSON file downloaded                                   |
| P1-10 | Export CSV          | Click Export, choose CSV                                  | Valid CSV file with headers                                  |
| P1-11 | File reconciliation | Move a media file, click Check Files                      | Moved file detected, update path works                       |
| P1-12 | Overlay close       | Click × or press Escape in overlay                        | Overlay hides                                                |

## P2 — Nice to Have

| ID    | Test                  | Steps                                                   | Expected                            |
| ----- | --------------------- | ------------------------------------------------------- | ----------------------------------- |
| P2-01 | Cloud sync (GDrive)   | Configure Google Drive credentials, upload/download     | Bookmarks synced                    |
| P2-02 | Cloud sync (Dropbox)  | Configure Dropbox credentials, upload/download          | Bookmarks synced                    |
| P2-03 | Multi-sort            | Enable multi-sort in window                             | Multiple sort criteria applied      |
| P2-04 | Filter presets        | Save and apply filter presets in window                 | Presets saved and restore correctly |
| P2-05 | Max bookmarks         | Set max bookmarks preference, add beyond limit          | OSD warning, bookmark rejected      |
| P2-06 | Special characters    | Add bookmark with `<script>alert('xss')</script>` title | HTML stripped, no XSS               |
| P2-07 | Long titles           | Add bookmark with 255-char title                        | Title truncated/displayed correctly |
| P2-08 | Concurrent cloud sync | Start upload, immediately try another sync              | "Already in progress" error         |

## Regression Notes

- After any persistence change, always verify P0-05
- After any UI change, check all 3 variants (sidebar, overlay, window)
- After any message handler change, verify the full CRUD flow (P0-02 through P0-04)
