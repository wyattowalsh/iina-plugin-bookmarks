# Add Internationalization (i18n) Support to Plugin UI

**Objective:** Enable translation of all user-facing text and provide infrastructure to support multiple languages.

## Tasks
- [ ] Externalize all static strings into locale files.
- [ ] Use a lightweight i18n library or custom string loader.
- [ ] Detect system or IINA locale and load the correct translation.
- [ ] Provide English strings and stubs for additional languages.
- [ ] Allow developers to add languages easily.

## Acceptance Criteria
- Plugin UIs load appropriate translation file per system locale.
- All visible strings are localized.
- English fallback works when translation missing.
