# Release Runbook

This repository publishes releases from `.github/workflows/release.yml` and only for pushed tags that match `v*`.

## 1) Local Preflight

Run the same canonical lane used by the release workflow:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps webkit
RELEASE_TAG=vX.Y.Z make release-run
```

Optional local clean-room gate (clean install + canonical release lane):

```bash
make release
```

## 2) Tag-Based Publish Steps

```bash
git checkout main
git pull --ff-only origin main
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

## 3) Verify Release

1. Confirm the **Release** workflow run passes for the pushed tag.
2. Confirm the GitHub Release is created for the tag.
3. Confirm `packaging/iina-plugin-bookmarks.iinaplgz` is attached to the release.

## 4) Go / No-Go Checklist

- `package.json` version, `Info.json` version, and `CHANGELOG.md` release section match the tag.
- `RELEASE_TAG=vX.Y.Z make release-run` passes locally.
- Docs build passes (`cd docs && pnpm install --frozen-lockfile && pnpm run build`).
- Release workflow is green for the pushed tag.

## 5) Rollback Notes

If a bad tag/release was pushed:

1. Delete the GitHub Release for the tag.
2. Delete the remote tag: `git push --delete origin vX.Y.Z`
3. Delete local tag: `git tag -d vX.Y.Z`
4. Fix the issue, rerun preflight, cut a new tag.
