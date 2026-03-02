# AGENTS.md

Project agents must preserve a release-safe workflow and stay aligned with CI/release automation.

## Release gating (before tagging/publishing)

- Preferred local gate: `make release` (clean/install/lint/type-check/test/test-e2e/build/package/validate).
- If run step-by-step, ensure: `pnpm run lint`, `pnpm run type-check`, `pnpm run test:coverage`, Playwright E2E (`pnpm exec playwright test`), `make build`, `make package` (or CI `make quick-package`), and `make validate`.
- Keep documentation in sync with behavior; when docs are changed, verify with `cd docs && pnpm install --frozen-lockfile && pnpm run build`.
- Keep release metadata consistent across `package.json` version, `Info.json` version, `CHANGELOG.md`, and `v*` release tag.

## Contributor release checklist references

- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/testing-playbook.md`
- `.github/CONTRIBUTING.md`
