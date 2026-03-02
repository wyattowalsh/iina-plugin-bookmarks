# Homebrew tap scaffold (community-maintained)

This repository includes a tap-ready cask scaffold for `iina-plugin-bookmarks`.

- Cask file: `packaging/homebrew/Casks/iina-plugin-bookmarks.rb`
- Current release target: `v1.1.0`

## Use with a tap repository

This project is **not** a Homebrew tap itself. Create a dedicated tap repo (for example `homebrew-iina-plugin-bookmarks`) and copy `Casks/iina-plugin-bookmarks.rb` into it.

Example end-user install flow:

```bash
brew tap <owner>/homebrew-iina-plugin-bookmarks
brew install --cask iina-plugin-bookmarks
```

## Update for a new release

1. Set `version` in the cask to the new tag version.
2. Set `sha256` to the checksum of:
   - `https://github.com/wyattowalsh/iina-plugin-bookmarks/releases/download/vX.Y.Z/iina-plugin-bookmarks.iinaplgz`
3. Commit and push the tap update.

## Notes

- The cask installs plugin contents to:
  - `~/Library/Application Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin`
- Restart IINA after install/upgrade.
