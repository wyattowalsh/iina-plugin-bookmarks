# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- ESLint, Prettier, and Husky pre-commit hooks
- CI/CD workflows (lint, type-check, test, build, audit)
- Dependabot configuration
- Comprehensive README rewrite
- CHANGELOG in conventional format
- PR template with CI checklist
- Bookmark import from JSON and CSV with duplicate handling strategies
- Import action in plugin UI (window and sidebar)

### Fixed

- `jumpToBookmark()` uses `seekTo()` instead of `seek()` (correct IINA API)
- Info.json: `network-request` permission, `ghRepo`, scoped `allowedDomains`
- API injection vulnerability in cloud-storage.ts filename sanitization
- Data backup before bookmark writes with recovery fallback
- `maxBookmarks` limit enforcement in `addBookmark()`
- `window.*` usage replaced with `globalThis.*` in JavaScriptCore context
- Title cleaning regex improvements

### Changed

- Upgraded `iina-plugin-definition` from 0.0.7 to 0.99.3
- Upgraded TypeScript, Vitest, and Prettier to latest versions
- `tsconfig.build.json`: strict mode, ES2019 target, removed DOM lib
- `browserslist` updated to `safari >= 14`
- Consolidated duplicate interfaces into `types.ts`
- Removed stale build artifacts from git tracking
- Preferences page updated with cloud backup controls

## [1.0.0] - 2025-06-05

### Added

- Core bookmark management (add, edit, delete, jump to timestamp)
- Tag-based organization with auto-tagging
- Multi-criteria filtering and sorting
- JSON and CSV export
- Cloud backup support (Google Drive, Dropbox)
- File reconciliation for moved/renamed media files
- IINA sidebar, standalone window, and video overlay interfaces
- Metadata detection with intelligent title extraction
- Plugin menu integration
- Preferences page
- Comprehensive test suite

[Unreleased]: https://github.com/wyattowalsh/iina-plugin-bookmarks/compare/main...HEAD
[1.0.0]: https://github.com/wyattowalsh/iina-plugin-bookmarks/releases/tag/v1.0.0
