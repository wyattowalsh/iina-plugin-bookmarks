# Add Robust Error Handling and Logging Mechanisms

**Objective:** Improve fault tolerance and log detail for debugging and production use.

## Tasks
- [ ] Wrap file I/O and JSON parsing with error handlers.
- [ ] Log all warnings/errors with timestamps using `iina.console`.
- [ ] Show user-friendly error dialogs when necessary.
- [ ] Add structured debug logging to core logic paths.

## Acceptance Criteria
- All plugin errors are logged with timestamps.
- Users receive actionable error messages in UI.
- Plugin gracefully handles invalid states or failed operations.
