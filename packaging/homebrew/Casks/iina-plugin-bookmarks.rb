cask "iina-plugin-bookmarks" do
  version "1.1.0"
  sha256 "051cef8c983b0585a415101364c04c448d580f86a12aa07076a257f25ddb031d"

  url "https://github.com/wyattowalsh/iina-plugin-bookmarks/releases/download/v#{version}/iina-plugin-bookmarks.iinaplgz"
  name "IINA Plugin Bookmarks"
  desc "Bookmark management plugin for IINA"
  homepage "https://github.com/wyattowalsh/iina-plugin-bookmarks"

  depends_on macos: ">= :catalina"
  depends_on cask: "iina"

  installer script: {
    executable: "/bin/bash",
    args: [
      "-c",
      <<~EOS,
        set -euo pipefail
        archive="$1"
        plugin_dir="$HOME/Library/Application Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin"
        rm -rf "$plugin_dir"
        mkdir -p "$plugin_dir"
        unzip -oq "$archive" -d "$plugin_dir"
      EOS
      "--",
      "#{staged_path}/iina-plugin-bookmarks.iinaplgz",
    ],
  }

  uninstall script: {
    executable: "/bin/bash",
    args: [
      "-c",
      'rm -rf "$HOME/Library/Application Support/com.colliderli.iina/plugins/iina-plugin-bookmarks.iinaplugin"',
    ],
  }

  caveats <<~EOS
    Restart IINA after install/upgrade.
  EOS
end
