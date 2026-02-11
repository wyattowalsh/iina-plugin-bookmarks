# IINA Bookmarks Plugin

A comprehensive bookmark management plugin for IINA video player with cloud backup, file reconciliation, and advanced UI features.

## ✨ Features

### 🎯 Core Bookmark Management

- **Add Bookmarks**: Create bookmarks at any point in your media
- **Smart Organization**: Tag-based organization with advanced filtering
- **Quick Navigation**: Jump to any bookmark with a single click
- **Bulk Operations**: Import/export bookmarks in JSON format

### ☁️ Cloud Backup & Sync

- **Google Drive Integration**: Secure backup to your Google Drive
- **Dropbox Support**: Alternative cloud storage option
- **Three Sync Modes**:
  - Upload: Push local bookmarks to cloud
  - Download: Fetch bookmarks from cloud
  - Sync: Two-way merge with conflict resolution
- **Automatic Metadata**: Device info and timestamps for all backups

### 📁 File Reconciliation

- **Moved File Detection**: Automatically detect when media files have been moved
- **Smart Search**: Find similar files based on name patterns
- **Three Resolution Options**:
  - Update bookmark path to new location
  - Remove bookmarks for missing files  
  - Manual path correction
- **Bulk Reconciliation**: Handle multiple moved files at once

### 🎨 Advanced UI

- **Sidebar Integration**: Dedicated IINA sidebar tab
- **Overlay Support**: Quick bookmark access during playback
- **Standalone Window**: Full-featured bookmark manager
- **Plugin Menu**: All actions accessible from IINA's plugin menu
- **Dark Mode**: Seamless integration with IINA's appearance

## 🚀 Installation

1. Download the latest `.iinaplgz` file from releases
2. Double-click to install in IINA, or manually place in:
   - `~/Library/Application Support/IINA/plugins/`
3. Restart IINA
4. Access bookmarks via the sidebar tab or Plugin menu

## 📖 Usage

### Adding Bookmarks

- **Menu**: Plugin → Add Bookmark
- **Sidebar**: Click "Add Bookmark" button
- **Keyboard**: Set custom shortcut in IINA preferences

### Managing Bookmarks

- **Sidebar**: Browse and filter all bookmarks
- **Search**: Use advanced search with tags and metadata
- **Edit**: Click any bookmark to modify title, description, or tags

### Cloud Backup

1. Open Plugin → Sync with Cloud
2. Choose provider (Google Drive or Dropbox)  
3. Enter API credentials
4. Select sync mode and click "Sync"

> **Note**: Cloud features require API credentials. See [Cloud Setup Guide](docs/cloud-setup.md) for details.

### File Reconciliation

1. Click "Check Files" in sidebar
2. Review bookmarks with missing files
3. Choose resolution:
   - Search for similar files automatically
   - Update path manually
   - Remove bookmark

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm
- IINA (for testing)

### Setup

```bash
git clone https://github.com/wyattowalsh/iina-plugin-bookmarks.git
cd iina-plugin-bookmarks
pnpm install
```

### Build Commands

```bash
# Development
make dev          # Start development servers
make build        # Build TypeScript and UI
make package      # Create .iinaplgz package

# Testing  
make test         # Run test suite
make test-watch   # Run tests in watch mode

# Release
make release      # Clean, build, test, and package
```

### Project Structure

```text
src/
├── index.ts                 # Main plugin entry
├── bookmark-manager.ts      # Core bookmark logic
├── cloud-storage.ts         # Cloud backup service
└── types.ts                 # TypeScript definitions

ui/
├── sidebar/                 # Sidebar interface
├── window/                  # Standalone window
├── overlay/                 # Video overlay
└── components/              # Shared UI components

tests/                       # Test suite
packaging/                   # Built plugin packages
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgements

- IINA team for the excellent media player and plugin architecture
- Contributors and beta testers
- Open source libraries used in this project

## 📚 Documentation

- [API Reference](docs/api.md)  
- [Cloud Setup Guide](docs/cloud-setup.md)
- [Development Guide](docs/development.md)
- [Changelog](CHANGELOG.md)