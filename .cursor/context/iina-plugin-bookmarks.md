# `iina-plugin-bookmarks` main project context knowledge file

> iina plugin for user-friendly media bookmark management that allows users to easily add, edit, and organize bookmarks within their media player.

---

## Features

### Core Functionality (Foundation Implemented)

- **Bookmark CRUD:** Create, read, edit, delete, and update bookmarks.
- **Persistent Storage:** Bookmarks are saved using IINA's preference system.
- **Multiple UI Views:**
  - **Video Overlay:** Displays contextual bookmarks on the video player.
  - **Sidebar Tab:** Manages bookmarks for the currently playing video.
  - **Standalone Window:** Provides a comprehensive view of all bookmarks with basic search/sort.
- **Key Interactions:**
  - Jump to bookmark timestamp.
  - Hide video overlay.
- **PostMessage Communication:** Secure and decoupled communication between plugin core and UIs.

### Planned Enhancements (Prioritized)

**Tier 1: Core Usability & Data Management Boosters**

- **Advanced UI Controls:**
  - **Comprehensive Filtering:** Filter bookmarks by title, description, tags, date, etc., in all views.
  - **Enhanced Sorting:** Sort bookmarks by multiple criteria (e.g., timestamp, title, creation date, modification date).
  - **Robust Search:** Improve search capabilities within the standalone window and potentially sidebar.
- **Extended Bookmark Metadata:**
  - **Tags:** Add support for categorizing bookmarks with tags.
  - **Auto-Population:** Option to automatically populate bookmark titles/descriptions from media file metadata if available.
- **Import/Export Bookmarks:**
  - Implement functionality to export bookmarks to JSON or CSV.
  - Allow importing bookmarks from JSON or CSV files.
- **Keyboard Shortcuts:**
  - Define and implement configurable keyboard shortcuts for common actions (e.g., add bookmark, toggle overlay, open window).
- **Plugin Settings/Preferences:**
  - Introduce a settings panel for user preferences (e.g., default bookmark title format, auto-hide overlay delay, timestamp display format).

**Tier 2: Workflow & Interface Refinements**

- **Undo/Redo Functionality:** Implement undo/redo for bookmark creation, deletion, and updates.
- **UI Customization (Basic):**
  - Offer simple UI customization options (e.g., theme selection - light/dark, font size adjustments).
- **Accessibility (A11y) Enhancements:**
  - Thoroughly review and improve UI components for WCAG compliance (keyboard navigation, ARIA attributes, color contrast).
- **Drag & Drop Support:**
  - Allow reordering or managing bookmarks via drag and drop within the standalone window or sidebar.
- **Improved Visual Feedback:** Enhance UI cues for actions like saving, loading, errors.

**Tier 3: Advanced Features & Long-Term Goals**

- **Internationalization (i18n):**
  - Structure the plugin and UIs to support multiple languages.
- **Rich Text Descriptions:** Allow markdown or rich text for bookmark descriptions.
- **Automatic Backups (Optional):**
  - Explore options for periodic automatic backups to a local file or optional cloud storage.
- **Sharing/Collaboration (Conceptual):**
  - (Very Long Term) Investigate possibilities for sharing bookmark sets.

### Development & Quality Goals (Ongoing)

- **Comprehensive Testing:** Continuously expand unit, integration, and end-to-end tests.
- **Performance Optimization:** Ensure the plugin remains lightweight and efficient.
- **Robust Error Handling & Logging:** Provide clear error messages and detailed logs for easier troubleshooting.
- **In-Plugin Documentation:** Integrate user guides or help tips directly within the plugin.
- **Responsive Design:** Ensure all UI elements are responsive and adapt well to different IINA window sizes.

---

## Dev Notes

- github repo created: `https://github.com/wyattowalsh/iina-plugin-bookmarks`
- project was initialized via the `iina-plugin` cli tool and included a video overlay template, side bar view template, standalone window template, and depends on React.
- initial prompt context knowledge files added to .cursor/context/ for the iina-plugin docs and the iina-plugin-definition repo (https://github.com/iina/iina-plugin-definition)
- refactored code base to use typescript
- updated `./Info.json` with relevant metadata
- added `.github/` templates
- refactored plugin-to-UI communication to exclusively use `postMessage` API, enhancing encapsulation and adhering to IINA best practices.
- removed direct global exposure of `bookmarkManager` instance; all interactions are now message-based.
- modified `BookmarkData` interface to use ISO 8601 string representation for `createdAt` timestamps, ensuring reliable JSON serialization for `postMessage`.
- configured the video overlay to be clickable and marked interactive elements within it for proper event handling by IINA.
- updated all UI components (overlay, sidebar, window) to:
  - send a `UI_READY` message on mount to the plugin core.
  - handle `BOOKMARKS_UPDATED` messages from the plugin core to refresh their state.
  - dispatch all actions (CRUD operations, navigation) via `postMessage` to the plugin core.
- enhanced the main plugin script (`src/index.ts`) to:
  - listen for and process various messages from UIs (e.g., `UI_READY`, `REQUEST_FILE_PATH`, CRUD actions, `HIDE_OVERLAY`, `JUMP_TO_BOOKMARK`).
  - respond to `UI_READY` by sending appropriately filtered bookmark data (path-specific for overlay/sidebar, all for main window).
  - broadcast `BOOKMARKS_UPDATED` messages when the bookmark list changes.
- ensured the overlay and sidebar UIs display bookmarks filtered for the currently playing video file.
- ensured the main window UI displays all bookmarks, with client-side search and sort capabilities.

---

## Project Structure

```txt
🗁 iina-plugin-bookmarks
 ┣ 📁 .cursor
 ┃ ┗ 📁 context
 ┃ ┃ ┣ 📄 iina-plugin-bookmarks.md.txt      # main project context knowledge file
 ┃ ┃ ┣ 📄 iina-plugin-definition-docs.md.txt  # repomix repo dump of iina plugin definition
 ┃ ┃ ┣ 📄 iina-plugin-docs.md.txt           # repomix repo dump of iina website
 ┃ ┃ ┗ 📄 README.md                         # README for .cursor/context
 ┣ 📁 .github
 ┃ ┣ 📁 ISSUE_TEMPLATE
 ┃ ┃ ┗ 📄 ...                                # Issue templates
 ┃ ┣ 📄 CODE_OF_CONDUCT.md
 ┃ ┣ 📄 CONTRIBUTING.md
 ┃ ┗ 📄 PULL_REQUEST_TEMPLATE.md
 ┣ 📁 .vscode                                # VSCode specific settings (if any)
 ┃ ┗ 📄 ...
 ┣ 📁 dist                                  # build output directory (auto-generated)
 ┃ ┗ 📄 ...                                  # (e.g. index.js, global.js, UI bundles)
 ┣ 📁 node_modules                           # project dependencies (auto-generated by npm/yarn)
 ┃ ┗ 📄 ...
 ┣ 📁 src
 ┃ ┣ 📄 global.ts                           # global plugin configurations and utilities
 ┃ ┗ 📄 index.ts                            # main plugin entry point (TypeScript)
 ┣ 📁 ui
 ┃ ┣ 📁 overlay
 ┃ ┃ ┣ 📄 app.tsx                           # React component for video overlay view (TypeScript)
 ┃ ┃ ┣ 📄 index.html                        # HTML entry point for overlay
 ┃ ┃ ┣ 📄 index.js                          # JavaScript entry point for overlay (renders app.tsx)
 ┃ ┃ ┗ 📄 overlay.scss                      # SCSS styles for overlay
 ┃ ┣ 📁 sidebar
 ┃ ┃ ┣ 📄 app.tsx                           # React component for sidebar view (TypeScript)
 ┃ ┃ ┣ 📄 index.html                        # HTML entry point for sidebar
 ┃ ┃ ┣ 📄 index.js                          # JavaScript entry point for sidebar (renders app.tsx)
 ┃ ┃ ┗ 📄 sidebar.scss                      # SCSS styles for sidebar
 ┃ ┣ 📁 window
 ┃ ┃ ┣ 📄 app.tsx                           # React component for standalone window view (TypeScript)
 ┃ ┃ ┣ 📄 index.html                        # HTML entry point for window
 ┃ ┃ ┣ 📄 index.js                          # JavaScript entry point for window (renders app.tsx)
 ┃ ┃ ┗ 📄 window.scss                       # SCSS styles for window
 ┃ ┗ 📄 shared.scss                         # shared styles across all UI components
 ┣ 📄 .gitignore                            # git ignore patterns
 ┣ 📄 .parcelrc                             # parcel bundler configuration
 ┣ 📄 Info.json                             # plugin metadata and configuration
 ┣ 📄 LICENSE                               # MIT license file
 ┣ 📄 package.json                          # npm package configuration and dependencies
 ┣ 📄 README.md                             # project documentation
 ┗ 📄 tsconfig.json                         # TypeScript project configuration
```
