# AGENTS.md

Project agents must preserve a release-safe workflow and stay aligned with CI/release automation.

## Release gating (before tagging/publishing)

- Preferred local gate: `make release` (clean/install + canonical `make release-run` checks).
- Canonical lane (matches `.github/workflows/release.yml`): `RELEASE_TAG=vX.Y.Z make release-run`.
- If run step-by-step, ensure: `make release-guard` (with `RELEASE_TAG=vX.Y.Z` for tags), `pnpm run lint`, `pnpm run type-check`, `pnpm run test:coverage`, `make test-e2e-release`, `make build`, `make package`, `make validate`, and `make validate-artifact`.
- Keep documentation in sync with behavior; when docs are changed, verify with `cd docs && pnpm install --frozen-lockfile && pnpm run build`.
- Keep release metadata consistent across `package.json` version, `Info.json` version, `CHANGELOG.md`, and `v*` release tag.

## Contributor release checklist references

- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/testing-playbook.md`
- `.github/CONTRIBUTING.md`
- `.github/RELEASE_RUNBOOK.md`
