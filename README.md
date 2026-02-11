# IINA Plugin Bookmarks

![CI](https://github.com/wyattowalsh/iina-plugin-bookmarks/actions/workflows/ci.yml/badge.svg)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

A bookmark management plugin for [IINA](https://iina.io) that lets you save, organize, and navigate to specific moments in your media files.

## Features

- **Bookmark Management** -- Create, edit, delete, and jump to bookmarks at any playback position
- **Tag System** -- Organize bookmarks with tags, auto-tagging, and multi-criteria filtering
- **Search and Sort** -- Advanced search across titles, descriptions, and tags with multi-criteria sorting
- **Import / Export** -- JSON and CSV support with duplicate handling and validation
- **Cloud Backup** -- Optional Google Drive and Dropbox integration for backup and sync
- **File Reconciliation** -- Detect and resolve bookmarks pointing to moved or renamed files
- **Multiple Interfaces** -- IINA sidebar tab, standalone management window, and video overlay
- **Smart Metadata** -- Automatic title detection from media metadata with intelligent fallbacks

## Prerequisites

- [Node.js](https://nodejs.org) 22+
- [pnpm](https://pnpm.io)
- [IINA](https://iina.io) 1.3+ (for running the plugin)

## Installation

1. Download the latest `.iinaplgz` file from [Releases](https://github.com/wyattowalsh/iina-plugin-bookmarks/releases/latest).
2. Double-click the file to install it in IINA, or extract it manually:
   ```bash
   mkdir -p ~/Library/Application\ Support/com.colliderli.iina/plugins/
   unzip iina-plugin-bookmarks.iinaplgz -d ~/Library/Application\ Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin
   ```
3. Restart IINA.
4. The **Bookmarks** tab appears in the sidebar. Plugin menu items are available under the Plugin menu.

### Development Symlink

For development, create a symlink so IINA loads the plugin directly from your working copy:

```bash
ln -s /path/to/iina-plugin-bookmarks ~/Library/Application\ Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin-dev
```

## Development

```bash
pnpm install          # Install dependencies
make dev              # Start dev servers (sidebar, overlay, window)
make build            # Build plugin (TypeScript + UI)
make test             # Run tests
pnpm test             # Run tests (alternative)
pnpm run lint         # Run linter
pnpm run format       # Format code
pnpm run type-check   # TypeScript type checking
make package          # Build and package as .iinaplgz
make release          # Full release pipeline: clean, install, type-check, test, build, package, validate
```

## Project Structure

```text
src/
  index.ts                  Main plugin entry point
  bookmark-manager.ts       Core bookmark logic
  cloud-storage.ts          Cloud backup service
  metadata-detector.ts      Media metadata detection
  types.ts                  TypeScript type definitions

ui/
  sidebar/                  IINA sidebar interface
  window/                   Standalone management window
  overlay/                  Video overlay
  components/               Shared React components

tests/                      Test suite (Vitest)
docs/                       Documentation site (Fumadocs)
dist/                       Build output
packaging/                  Plugin package output
```

## Contributing

- Pre-commit hooks (ESLint, Prettier) run automatically on commit via Husky.
- Branch naming: `feat/description`, `fix/description`, `chore/description`.
- All PRs should pass CI checks: lint, type-check, test, build.
- See [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) for the PR checklist.

For detailed contributing guidelines, see [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## License

[ISC](LICENSE)
