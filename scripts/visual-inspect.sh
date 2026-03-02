#!/bin/bash
# Visual inspection of IINA Bookmarks plugin
# All windows positioned on LG ULTRAGEAR (1) = Main Display = -D 1
# Captures Display 1 only

set -euo pipefail

OUT="/tmp/iina-visual-inspect"
rm -rf "$OUT"
mkdir -p "$OUT"
VIDEO="/Users/ww/Downloads/fractal_zoom (2).mp4"
PLUGIN_DATA="$HOME/Library/Application Support/com.colliderli.iina/plugins/.data/com.wyattowalsh.iina-plugin-bookmarks"
STEP=1

echo "=== IINA Bookmarks Plugin — Visual Inspection ==="
echo "Target: LG ULTRAGEAR (1) / Main Display"
echo "Output: $OUT"
echo ""

# ── Helpers ──────────────────────────────────────────────────
snap() {
  local name="$1"
  local idx
  idx=$(printf "%02d" "$STEP")
  sleep 0.5
  screencapture -x -D 2 "$OUT/${idx}-${name}.png"
  echo "  📸 [$idx] $name"
  STEP=$((STEP + 1))
}

move_iina_to_main() {
  osascript <<'AS'
    tell application "IINA" to activate
    delay 0.5
    tell application "System Events"
      tell process "IINA"
        try
          -- Position on LG ULTRAGEAR 1 (Display 2 in screencapture numbering)
          -- If Display 2 is right of Display 1, coordinates start at x=2560
          set position of front window to {2660, 50}
          set size of front window to {1200, 750}
        on error errMsg
          -- If front window fails, try "Move to" menu
          try
            click menu item "Move to LG ULTRAGEAR" of menu "Window" of menu bar 1
          end try
        end try
      end tell
    end tell
    delay 1
AS
}

click_bookmark_menu() {
  local item_name="$1"
  osascript -e "
    tell application \"System Events\"
      tell process \"IINA\"
        try
          set pluginMenu to menu \"Plugin\" of menu bar 1
          set subMenuItem to menu item \"Bookmarks\" of pluginMenu
          set subMenu to menu \"Bookmarks\" of subMenuItem
          click menu item \"$item_name\" of subMenu
        on error
          try
            click menu item \"$item_name\" of menu \"Plugin\" of menu bar 1
          end try
        end try
      end tell
    end tell
  " 2>/dev/null
}

# ── 1. Kill IINA + clear old data ────────────────────────────
echo "1. Killing existing IINA..."
pkill -9 IINA 2>/dev/null || true
sleep 2
rm -f "$PLUGIN_DATA/bookmarks-backup.json" 2>/dev/null || true

# ── 2. Launch IINA on Main Display ───────────────────────────
echo "2. Launching IINA with video..."
open -a IINA "$VIDEO"
sleep 6
move_iina_to_main

snap "video-playing"

# ── 3. Open sidebar ──────────────────────────────────────────
echo "3. Opening sidebar..."
osascript -e '
  tell application "System Events"
    tell process "IINA"
      try
        click menu item "Toggle Sidebar" of menu "View" of menu bar 1
      on error
        try
          click menu item "Show Sidebar" of menu "View" of menu bar 1
        end try
      end try
    end tell
  end tell
' 2>/dev/null
sleep 2

snap "sidebar-open"

# ── 4. List Plugin menu ──────────────────────────────────────
echo "4. Plugin menu items:"
osascript -e '
  tell application "System Events"
    tell process "IINA"
      try
        return name of every menu item of menu "Plugin" of menu bar 1
      end try
    end tell
  end tell
' 2>&1 | tr ',' '\n' | grep -v "missing value" | sed 's/^/     /'

# ── 5. Seek + add bookmark via menu ──────────────────────────
echo "5. Seeking forward + adding bookmark..."
osascript -e '
  tell application "IINA" to activate
  delay 0.3
  tell application "System Events"
    tell process "IINA"
      repeat 10 times
        key code 124
        delay 0.15
      end repeat
    end tell
  end tell
' 2>/dev/null
sleep 1

click_bookmark_menu "Add Bookmark at Current Time"
sleep 2

snap "bookmark-added"

# ── 6. Quick bookmark (Ctrl+B) ───────────────────────────────
echo "6. Seeking more + quick bookmark (Ctrl+B)..."
osascript -e '
  tell application "IINA" to activate
  delay 0.3
  tell application "System Events"
    tell process "IINA"
      repeat 15 times
        key code 124
        delay 0.15
      end repeat
      delay 0.5
      keystroke "b" using control down
    end tell
  end tell
' 2>/dev/null
sleep 2

snap "quick-bookmark"

# ── 7. Wait for debounced backup ─────────────────────────────
echo "7. Waiting 5s for debounced auto-backup..."
sleep 5

echo "   Checking backup file:"
if [ -f "$PLUGIN_DATA/bookmarks-backup.json" ]; then
  BACKUP_SIZE=$(wc -c < "$PLUGIN_DATA/bookmarks-backup.json" | tr -d ' ')
  LINE_COUNT=$(wc -l < "$PLUGIN_DATA/bookmarks-backup.json" | tr -d ' ')
  echo "   ✓ bookmarks-backup.json ($BACKUP_SIZE bytes, $LINE_COUNT lines)"
  if [ "$LINE_COUNT" -le 2 ]; then
    echo "   ✓ Compact JSON — HR-S-008 confirmed"
  else
    echo "   ⚠ Pretty-printed ($LINE_COUNT lines)"
  fi
  echo "   Preview: $(head -c 200 "$PLUGIN_DATA/bookmarks-backup.json")"
else
  echo "   ✗ NOT FOUND (bookmark may not have been added, or file API unavailable)"
fi

# ── 8. Toggle overlay ────────────────────────────────────────
echo "8. Opening overlay..."
click_bookmark_menu "Toggle Bookmarks Overlay"
sleep 2

snap "overlay-open"

# ── 9. Close overlay ─────────────────────────────────────────
echo "9. Closing overlay (Escape)..."
osascript -e '
  tell application "System Events"
    tell process "IINA"
      key code 53
    end tell
  end tell
' 2>/dev/null
sleep 1

snap "overlay-closed"

# ── 10. Open standalone manager window ───────────────────────
echo "10. Opening Manage Bookmarks window..."
click_bookmark_menu "Manage Bookmarks"
sleep 3

snap "manage-window"

# ── 11. Check preferences storage ────────────────────────────
echo "11. Checking preferences:"
FOUND_KEYS=$(defaults read com.colliderli.iina 2>/dev/null | grep -c "bookmark" || true)
echo "    Bookmark-related keys in plist: $FOUND_KEYS"
defaults read com.colliderli.iina 2>/dev/null | grep -i "bookmark" | head -5 | sed 's/^/    /'

# ── 12. Plugin data directory ────────────────────────────────
echo "12. Plugin data directory:"
ls -la "$PLUGIN_DATA/" 2>/dev/null | sed 's/^/    /' || echo "    Not found"

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=== Screenshots (Display 1 / LG ULTRAGEAR 1) ==="
for f in "$OUT"/*.png; do
  SIZE=$(wc -c < "$f" | tr -d ' ')
  echo "  $(basename "$f")  ($SIZE bytes)"
done
echo ""
echo "open $OUT"
echo "=== Done ==="
