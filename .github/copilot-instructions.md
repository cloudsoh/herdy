# Copilot Instructions

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description
```

- **Types:** `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `perf` | `ci`
- **Scope:** optional, e.g. `status`, `config`, `logs`, `cli`, `core`
- Subject line: 72 chars max, lowercase, no trailing period
- Use imperative mood: "add" not "added"
- Breaking changes: add `BREAKING CHANGE:` in the commit body

**Examples:**
```
feat(status): auto-detect service type from name suffix
fix(config): show line number in YAML parse errors
chore: bump version to 0.4.0
docs: add serviceType field to README
refactor(core): extract deriveServiceType helper
```
