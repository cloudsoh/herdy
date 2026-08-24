## Agent skills

### Issue tracker

Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

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
```
