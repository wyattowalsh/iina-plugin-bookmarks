# optimized-for-use-with-LLM-agentic-software-development-agents Developer Todo List

This an exhaustively and comprehensively composed "Developer Todo List" based on the latest, most-up-to-date versions (as of June 2025). It has been optimized for use with LLM-agentic software development agents.

---

## 🚀 Tier 1: Core Usability & Data Management Boosters

### 1.1 Advanced UI Controls
-   **Comprehensive Filtering:**
    -   [ ] **Design:** Define filterable fields (title, description, tags, creationDate, modifiedDate) and UI placement for filter controls in Overlay, Sidebar, and Window views.
    -   [ ] **Implement Filter Logic (`src/index.ts`):**
        -   [ ] Extend `BookmarkManager` to accept filter parameters when retrieving bookmarks.
        -   [ ] Ensure efficient filtering, especially for large bookmark sets.
    -   [ ] **Implement UI (`ui/**/app.tsx`):**
        -   [ ] Add filter input fields/dropdowns to Overlay, Sidebar, and Window UIs.
        -   [ ] Implement `postMessage` communication for filter state changes.
        -   [ ] Update UI to display filtered results reactively.
    -   [ ] **Testing:** Write unit tests for filter logic and E2E tests for UI filtering in all views.
-   **Enhanced Sorting:**
    -   [ ] **Design:** Define sortable criteria (timestamp, title, creationDate, modifiedDate, custom order via drag-and-drop eventually) and UI elements for sorting in all views.
    -   [ ] **Implement Sort Logic (`src/index.ts`):**
        -   [ ] Extend `BookmarkManager` to accept sort parameters.
        -   [ ] Implement stable sorting algorithms.
    -   [ ] **Implement UI (`ui/**/app.tsx`):**
        -   [ ] Add sort selection UI (e.g., dropdowns, clickable table headers) to Overlay, Sidebar, and Window UIs.
        -   [ ] Implement `postMessage` communication for sort state changes.
        -   [ ] Update UI to display sorted results reactively.
    -   [ ] **Testing:** Write unit tests for sorting logic and E2E tests for UI sorting.
-   **Robust Search:**
    -   [ ] **Standalone Window (`ui/window/app.tsx`):**
        -   [ ] **Backend:** Enhance `BookmarkManager` search to be more robust (e.g., fuzzy search, case-insensitivity options).
        -   [ ] **Frontend:** Implement a dedicated search input field.
        -   [ ] **Frontend:** Debounce search input to optimize performance.
        -   [ ] **Frontend:** Highlight search terms in results.
    -   [ ] **Sidebar (`ui/sidebar/app.tsx`):**
        -   [ ] Investigate feasibility and UX benefits of adding search to the sidebar.
        -   [ ] If implemented, follow similar steps as Standalone Window.
    -   [ ] **Testing:** Write unit tests for search logic and E2E tests for UI search functionality.

### 1.2 Extended Bookmark Metadata
-   **Tags:**
    -   [ ] **Data Model (`src/index.ts`):**
        -   [ ] Update `BookmarkData` interface to include a `tags?: string[]` field.
        -   [ ] Modify `BookmarkManager` CRUD operations to handle tags.
        -   [ ] Ensure tags are saved to and loaded from `iina.preferences`.
    -   [ ] **UI Implementation (`ui/**/app.tsx`):**
        -   [ ] Add UI elements for adding, displaying, and removing tags in the bookmark editing form (Window and potentially Sidebar).
        -   [ ] Display tags alongside bookmarks in all views.
        -   [ ] Integrate tags into filtering capabilities.
    -   [ ] **Testing:** Write unit tests for tag management in `BookmarkManager` and E2E tests for tag UI interactions.
-   **Auto-Population from Media Metadata:**
    -   [ ] **Plugin Core (`src/index.ts`):**
        -   [ ] Investigate IINA API capabilities for accessing media file metadata (e.g., title, chapter names).
        -   [ ] Implement logic in `BookmarkManager` to optionally pre-fill bookmark title/description based on current playback time and available metadata when a new bookmark is created.
        -   [ ] This should be a user-configurable option (see Plugin Settings).
    -   [ ] **UI (`ui/**/app.tsx`):**
        -   [ ] Reflect auto-populated data in the "add bookmark" UI.
    -   [ ] **Testing:** Test with various media file types and metadata availability.

### 1.3 Import/Export Bookmarks
-   [ ] **Design:** Define file formats (JSON required, CSV optional) and schema for import/export.
-   [ ] **Export Functionality (`src/index.ts` & `ui/window/app.tsx`):**
    -   [ ] **Core:** Implement `exportBookmarks(format: 'json' | 'csv')` in `BookmarkManager`.
    -   [ ] **UI:** Add an "Export Bookmarks" button in the Standalone Window settings/menu.
    -   [ ] **UI:** Allow users to choose format and trigger download (potentially using `iina.fileSystem.saveFilePanel`).
-   [ ] **Import Functionality (`src/index.ts` & `ui/window/app.tsx`):**
    -   [ ] **Core:** Implement `importBookmarks(data: string, format: 'json' | 'csv')` in `BookmarkManager`.
        -   [ ] Handle potential errors, duplicates, and schema mismatches gracefully.
        -   [ ] Provide feedback on import success/failure.
    -   [ ] **UI:** Add an "Import Bookmarks" button in the Standalone Window.
    -   [ ] **UI:** Allow users to select a file (using `iina.fileSystem.openFilePanel`).
    -   [ ] **UI:** Display import progress and results.
-   [ ] **Testing:** Test import/export with various valid and invalid file formats and data.

### 1.4 Keyboard Shortcuts
-   [ ] **Define Shortcuts:**
    -   [ ] Identify key actions for shortcuts (e.g., Add Bookmark, Toggle Overlay, Show/Hide Overlay, Open Bookmarks Window, Navigate Bookmarks in Overlay).
    -   [ ] Propose default, ergonomic key combinations.
-   [ ] **Implementation (`src/index.ts`):**
    -   [ ] Use `iina.menu.addItem` with `keyEquivalent` and `keyEquivalentModifierMask` to register global shortcuts for plugin-level actions.
    -   [ ] For UI-specific actions within active views (like Overlay navigation), explore event listeners within the UI if IINA's global shortcuts are not suitable or if they need to be context-aware.
-   [ ] **Configurability (see Plugin Settings):**
    -   [ ] Allow users to customize these shortcuts via the Plugin Settings panel.
-   [ ] **Documentation:** Document all default shortcuts.
-   [ ] **Testing:** Manually test all shortcuts for functionality and conflicts.

### 1.5 Plugin Settings/Preferences
-   [ ] **Design Settings Panel:**
    -   [ ] Plan UI for settings (likely within Standalone Window or a dedicated settings view).
    -   [ ] Identify all configurable options:
        -   Default bookmark title format.
        -   Auto-hide overlay (boolean, delay in seconds).
        -   Timestamp display format (e.g., HH:MM:SS, MM:SS, SS.ms).
        -   Enable/disable auto-population of bookmark metadata.
        -   Keyboard shortcut customization.
        -   (Future) Theme selection, font sizes.
-   [ ] **Storage (`src/index.ts`):**
    -   [ ] Use `iina.preferences` to store plugin settings.
    -   [ ] Define a clear schema/interface for settings data.
    -   [ ] Implement `getSetting(key)` and `setSetting(key, value)` in `BookmarkManager` or a dedicated settings manager.
-   [ ] **UI Implementation (`ui/window/app.tsx` or dedicated settings UI):**
    -   [ ] Create React components for each setting control.
    -   [ ] Load current settings on UI mount.
    -   [ ] Save settings via `postMessage` to the plugin core when changed.
-   [ ] **Apply Settings:**
    -   [ ] Ensure all parts of the plugin (core logic, UIs) respect the stored settings.
-   [ ] **Testing:** Test saving, loading, and application of all settings.

---

## 🎨 Tier 2: Workflow & Interface Refinements

### 2.1 Undo/Redo Functionality
-   [ ] **Design Strategy:**
    -   [ ] Determine scope: bookmark CUD operations.
    -   [ ] Choose implementation approach (e.g., command pattern, state stack).
-   [ ] **Core Implementation (`src/index.ts`):**
    -   [ ] Modify `BookmarkManager` to maintain a history of actions.
    -   [ ] Implement `undo()` and `redo()` methods.
    -   [ ] Manage history stack size (e.g., limit to N previous actions).
-   [ ] **UI Integration (`ui/**/app.tsx`):**
    -   [ ] Add "Undo" and "Redo" buttons/menu items to relevant UIs (likely Standalone Window, potentially Sidebar).
    -   [ ] Enable/disable buttons based on history availability.
    -   [ ] Use `postMessage` to trigger undo/redo in the core.
-   [ ] **Testing:** Write comprehensive tests for undo/redo logic with various sequences of actions.

### 2.2 UI Customization (Basic)
-   [ ] **Theme Selection (Light/Dark):**
    -   [ ] **Design:** Create or adapt light and dark color schemes for all UIs (`*.scss` files).
    -   [ ] **Implementation:** Add a theme toggle in Plugin Settings.
    -   [ ] **Implementation:** Dynamically apply theme classes to root UI elements.
-   [ ] **Font Size Adjustments:**
    -   [ ] **Design:** Define a few font size options (e.g., Small, Medium, Large).
    -   [ ] **Implementation:** Add font size selection in Plugin Settings.
    -   [ ] **Implementation:** Adjust base font size or use relative units that scale.
-   [ ] **Testing:** Manually verify UI consistency and readability across themes and font sizes.

### 2.3 Accessibility (A11y) Enhancements
-   [ ] **Audit Existing UIs:**
    -   [ ] Review Overlay, Sidebar, and Window components against WCAG 2.1/2.2 AA guidelines.
-   [ ] **Keyboard Navigation:**
    -   [ ] Ensure all interactive elements are focusable and operable via keyboard.
    -   [ ] Implement logical focus order.
    -   [ ] Provide clear visual focus indicators (ensure they respect `shared.scss`).
-   [ ] **ARIA Attributes:**
    -   [ ] Add appropriate ARIA roles, states, and properties to all UI elements, especially custom controls.
    -   [ ] Ensure dynamic content changes are announced by screen readers.
-   [ ] **Color Contrast:**
    -   [ ] Verify text and UI elements meet contrast requirements for both light and dark themes.
-   [ ] **Semantic HTML:**
    -   [ ] Use semantic HTML elements where appropriate.
-   [ ] **Testing:**
    -   [ ] Test with screen readers (e.g., VoiceOver, NVDA).
    -   [ ] Use accessibility audit tools (e.g., Axe, Lighthouse).
-   [ ] **Documentation:** Document accessibility features and any known limitations.

### 2.4 Drag & Drop Support
-   [ ] **Scope:** Primarily for reordering bookmarks in the Standalone Window list, potentially Sidebar.
-   [ ] **Library Research:** Investigate lightweight, React-friendly drag & drop libraries (e.g., `react-beautiful-dnd`, `dnd-kit`) suitable for the Parcel build environment.
-   [ ] **Implementation (`ui/window/app.tsx`, `ui/sidebar/app.tsx`):**
    -   [ ] Integrate chosen library.
    -   [ ] Allow users to drag bookmarks to reorder them.
    -   [ ] Persist the new order (requires adding an `order` or `sortIndex` field to `BookmarkData` or adjusting `BookmarkManager` logic).
    -   [ ] Provide clear visual cues for dragging and drop targets.
-   [ ] **Testing:** Test drag & drop functionality extensively, including edge cases.

### 2.5 Improved Visual Feedback
-   [ ] **Identify Key Actions:** List actions needing better feedback (e.g., saving/loading bookmarks, import/export, errors, successful operations).
-   [ ] **Design Feedback Mechanisms:**
    -   [ ] Subtle loading indicators/spinners.
    -   [ ] Toast notifications for success/error messages (consider a simple, custom implementation or a lightweight library).
    -   [ ] Visual confirmation for actions (e.g., brief highlight on added/updated bookmark).
-   [ ] **Implementation (`ui/**/app.tsx`, `shared.scss`):**
    -   [ ] Integrate feedback mechanisms into UI components.
    -   [ ] Ensure feedback is non-intrusive and accessible.
-   [ ] **Testing:** Manually verify feedback for all relevant actions.

---

## 🌟 Tier 3: Advanced Features & Long-Term Goals

### 3.1 Internationalization (i18n)
-   [ ] **Library Selection:** Choose a lightweight i18n library compatible with React and Parcel (e.g., `i18next`, `react-i18next`).
-   [ ] **String Extraction:**
    -   [ ] Identify all user-facing strings in UI components and core plugin messages.
    -   [ ] Refactor code to use the i18n library's functions for string lookups.
-   [ ] **Translation Files:**
    -   [ ] Create initial translation files (e.g., `en.json`).
    -   [ ] Structure files for easy addition of new languages.
-   [ ] **Language Switching:**
    -   [ ] Implement a language selector in Plugin Settings.
    -   [ ] Allow IINA's current language to be the default if detectable and supported.
-   [ ] **Testing:** Test with multiple languages (even if placeholder translations).
-   [ ] **Documentation:** Provide instructions for contributors to add new translations.

### 3.2 Rich Text Descriptions
-   [ ] **Requirement Analysis:** Define supported rich text features (e.g., bold, italic, lists, links; Markdown is a good candidate).
-   [ ] **Library Selection (if rendering Markdown):** Choose a lightweight Markdown-to-HTML renderer for React (e.g., `react-markdown`).
-   [ ] **Input Method:**
    -   [ ] Use a simple `<textarea>` for Markdown input.
    -   [ ] (Optional) Consider a lightweight WYSIWYG editor if full rich text is desired beyond Markdown.
-   [ ] **Data Model (`src/index.ts`):**
    -   [ ] Update `BookmarkData.description` to store raw Markdown/rich text.
-   [ ] **UI Implementation (`ui/**/app.tsx`):**
    -   [ ] Update bookmark editing forms to accept rich text/Markdown.
    -   [ ] Render the description appropriately in display views.
    -   [ ] Ensure proper sanitization if rendering HTML directly to prevent XSS.
-   [ ] **Testing:** Test input, storage, and rendering of rich text descriptions.

### 3.3 Automatic Backups (Optional)
-   [ ] **Strategy & Design:**
    -   [ ] Determine backup frequency (e.g., daily, weekly) - user configurable.
    -   [ ] Define backup location (local file in a designated plugin folder, requires `file-system` permission).
    -   [ ] Consider backup rotation (e.g., keep last N backups).
-   [ ] **Implementation (`src/index.ts`):**
    -   [ ] Add logic to `BookmarkManager` to trigger backups based on settings.
    -   [ ] Use `iina.fileSystem` for writing backup files (JSON format recommended).
-   [ ] **User Interface (Plugin Settings):**
    -   [ ] Add options to enable/disable auto-backups, set frequency, and specify location (if feasible).
    -   [ ] Provide a way to manually trigger a backup and restore from a backup.
-   [ ] **Testing:** Test backup creation, scheduling, and restoration.

### 3.4 Sharing/Collaboration (Conceptual - Very Long Term)
-   [ ] **Research & Feasibility Study:**
    -   [ ] Explore potential mechanisms for sharing (e.g., exporting/importing a shared format, P2P, or a lightweight central service if absolutely necessary and user-consented).
    -   [ ] This is a very advanced feature and requires careful consideration of privacy, security, and complexity. Defer active development until core features are mature.
-   [ ] **No immediate actions, document ideas and potential approaches.**

---

## 🛠️ Development & Quality Goals (Ongoing)

### 4.1 Comprehensive Testing
-   [ ] **Unit Tests (`*.test.ts`):**
    -   [ ] **Goal:** Achieve >80% unit test coverage for `src/index.ts` (BookmarkManager, utility functions).
    -   [ ] **Framework:** Use Jest (already set up via Parcel's default test runner or configure explicitly).
    -   [ ] Ensure all public methods of `BookmarkManager` have thorough tests, including edge cases.
-   [ ] **Integration Tests:**
    -   [ ] Test interactions between `BookmarkManager` and `iina.preferences`, `iina.postMessage`, `iina.menu`.
    -   [ ] Test message passing and state synchronization between plugin core and UI components.
-   [ ] **End-to-End (E2E) Tests:**
    -   [ ] **Strategy:** Explore options for E2E testing IINA plugins (may be challenging; manual testing might be primary for full E2E).
    -   [ ] **Focus:** Test key user flows: adding a bookmark, viewing overlay, using window, sorting/filtering.
    -   [ ] If automated E2E is not feasible, create detailed manual test scripts.
-   [ ] **CI/CD:**
    -   [ ] Set up GitHub Actions to run linters and tests on every push/PR.

### 4.2 Performance Optimization
-   [ ] **Profiling:**
    -   [ ] Regularly profile UI rendering performance (React DevTools Profiler).
    -   [ ] Identify and optimize slow operations in `BookmarkManager` (e.g., loading/saving large bookmark sets, complex filtering/sorting).
-   [ ] **React Optimizations:**
    -   [ ] Use `React.memo`, `useMemo`, `useCallback` where appropriate to prevent unnecessary re-renders.
    -   [ ] Implement virtualization (e.g., `react-window` or `react-virtualized`) for long bookmark lists in the Standalone Window.
-   [ ] **Bundle Size:**
    -   [ ] Monitor Parcel build output size.
    -   [ ] Optimize assets and dependencies to keep the plugin lightweight.

### 4.3 Robust Error Handling & Logging
-   [ ] **Error Boundaries (React):**
    -   [ ] Implement error boundaries in UI components (`ui/**/app.tsx`) to catch rendering errors gracefully.
-   [ ] **Plugin Core (`src/index.ts`):**
    -   [ ] Use `try...catch` blocks for operations that might fail (e.g., `iina.preferences` access, file system operations).
    -   [ ] Provide clear, user-friendly error messages via UI notifications or console.
-   [ ] **Logging:**
    -   [ ] Implement a simple logging utility or use `console.log/warn/error` consistently with prefixes for easier debugging.
    -   [ ] Log key events, errors, and state changes.
    -   [ ] Consider a debug mode (configurable in settings) for more verbose logging.

### 4.4 In-Plugin Documentation/Help
-   [ ] **Design:**
    -   [ ] Plan a "Help" or "About" section within the Standalone Window.
    -   [ ] Consider tooltips for complex UI elements.
-   [ ] **Content:**
    -   [ ] Briefly explain core features.
    -   [ ] List default keyboard shortcuts.
    -   [ ] Provide guidance on using settings.
    -   [ ] Link to GitHub repository for more detailed info or reporting issues.
-   [ ] **Implementation:**
    -   [ ] Create a simple React component for the help section.

### 4.5 Responsive Design
-   [ ] **Review UIs:**
    -   [ ] Test Overlay, Sidebar, and Window UIs at various IINA player sizes and window dimensions.
-   [ ] **CSS Enhancements (`*.scss`):**
    -   [ ] Use flexible layouts (Flexbox, Grid) and relative units.
    -   [ ] Implement media queries if necessary for specific breakpoints, though adaptive components are preferred.
    -   [ ] Ensure no content overflow or layout breakage at smaller sizes.

---

## 🧹 General Project Maintenance & Future-Proofing

-   [ ] **Dependency Management:**
    -   [ ] Regularly review and update dependencies (`package.json`) to latest stable versions.
    -   [ ] Use `npm audit` or similar tools to check for vulnerabilities.
-   [ ] **Code Quality & Linting:**
    -   [ ] Ensure ESLint and Prettier are configured and run consistently (e.g., pre-commit hook).
    -   [ ] Maintain high code readability and adhere to TypeScript best practices.
-   [ ] **Documentation (`README.md`, Wiki):**
    -   [ ] Keep `README.md` up-to-date with project status, features, and setup instructions.
    -   [ ] Consider using the GitHub Wiki for more detailed developer documentation or user guides.
-   [ ] **Refactoring:**
    -   [ ] Periodically review and refactor code for clarity, performance, and maintainability.
    -   [ ] Address any tech debt accumulated.
-   [ ] **Monitor IINA Updates:**
    -   [ ] Keep an eye on IINA releases and API changes that might affect the plugin.
    -   [ ] Ensure compatibility with the `minIINAVersion` specified in `Info.json` and update it as new IINA versions are targeted.