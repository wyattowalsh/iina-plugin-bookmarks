#!/usr/bin/env zsh

# -----------------------------------
# dump_music.sh
# Exports Title, Artist, Album, Year, Label
# from the Music (or iTunes) library
# into ~/Desktop/iTunesLibraryDump.txt
# -----------------------------------

# 1) Define where to write the output:
OUTPUT=~/Desktop/iTunesLibraryDump.txt

# 2) Use a quoted heredoc to feed AppleScript exactly as written:
osascript <<'APPLESCRIPT' > "$OUTPUT"
tell application "Music"
  -- a) Grab every track in the main library:
  set trackList to every track of library playlist 1

  -- b) Configure line breaks when joining list items:
  set AppleScript's text item delimiters to linefeed

  -- c) Prepare an empty list to accumulate one line per track:
  set outputLines to {}

  -- d) Loop through each track object 't':
  repeat with t in trackList
    -- Build a tab-delimited string and append it to 'outputLines':
    set end of outputLines to (
      name of t & "\t" & 
      artist of t & "\t" & 
      album of t & "\t" & 
      year of t & "\t" & 
      label of t
    )
  end repeat

  -- e) Return all lines (joined by newline):
  return outputLines as text
end tell
APPLESCRIPT

# 3) Notify the user that the export finished:
echo "Export complete: $OUTPUT"
