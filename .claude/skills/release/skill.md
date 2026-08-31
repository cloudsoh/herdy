---
name: release
description: "Determine the next semver version from commits since the last tag, write a CHANGELOG entry, bump package.json, and commit."
---

## Steps

### 1. Gather commits since last tag

```bash
git describe --tags --abbrev=0          # last tag, e.g. v0.5.4
git log <last-tag>..HEAD --pretty=format:"%H %s"
```

If there are no tags yet, use the full history.

### 2. Decide bump type

Read each commit subject and classify by conventional-commit type:

| Commit type | Bump |
|---|---|
| `feat` | **minor** (x.Y.0) |
| `fix`, `perf`, `refactor`, `docs`, `test`, `ci`, `chore` | **patch** (x.y.Z) |
| Any commit body contains `BREAKING CHANGE:` | **major** (X.0.0) |

Apply the highest bump found. If no commits qualify (e.g. all are `chore: bump version`), stop and tell the user there is nothing to release.

### 3. Compute new version

Read `"version"` from `package.json`. Apply the bump. Do **not** include a `v` prefix in `package.json`; the git tag will carry it.

### 4. Write the CHANGELOG entry

Prepend a new section to `CHANGELOG.md` immediately after the `# Changelog` heading line, following the existing format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Rules for the bullet points:
- One bullet per logical change (merge related commits when they describe the same change).
- Write in plain English — describe the user-visible behaviour or developer-facing effect, not the commit message verbatim.
- **Strip all project-specific names** (app names, team names, customer names, internal service names, repo names, URLs). Refer to things generically: "workspace", "service", "repo", "track", "config".
- Omit pure version-bump commits (`chore: bump version to ...`) and changelog-only commits.
- Only include sections (`### Added`, `### Changed`, `### Fixed`) that have at least one bullet; omit empty sections.

### 5. Update package.json

Set `"version": "X.Y.Z"` in `package.json`.

### 6. Commit

Stage `CHANGELOG.md` and `package.json` only. Commit:

```
chore: bump version to X.Y.Z
```

No other files. Do not create a git tag — that is left to the publish step.

### 7. Report

Print the new version, the bump type, and the number of commits included.
