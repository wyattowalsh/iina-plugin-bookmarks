# Expand Unit, Integration, and End-to-End Testing

**Objective:** Increase test coverage to ensure plugin stability and prevent regressions.

## Tasks
- [ ] Write unit tests for core bookmark logic (CRUD, sorting, filtering).
- [ ] Add integration tests for UI communication via postMessage.
- [ ] Use test IDs or mocks for standalone and sidebar UIs.
- [ ] Configure automated test runs (GitHub Actions optional).
- [ ] Measure and document coverage.

## Acceptance Criteria
- All major logic paths are covered by tests.
- UI events are validated via integration or E2E tests.
- CI passes on feature branches with full test suite.
