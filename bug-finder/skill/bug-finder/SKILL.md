---
name: bug-finder
description: Hunt for defects in a repository through one rotating lens per run — correctness, security, performance, DRY, slop, tech debt, best practices — verify each finding adversarially, and write a dated report. Report-only; never edits source. Use for /bug-finder, "find bugs in X", "audit this repo for <lens>", or a scheduled sweep that covers a different aspect each run.
argument-hint: "[next|all|<lens>] [--repo PATH] [--scope changed|hotspots|full] [--max N] [--issues]"
allowed-tools: Read, Write, Grep, Glob, Bash, Agent
---

# bug-finder

Each run looks at the repository through **one lens**, so findings stay focused and a schedule covers every aspect over time. The run finds candidates, tries to refute each one, and keeps only what survives. It writes a report and changes no source code.

Lenses, in rotation order (checklists in `references/lenses.md`):

| # | Lens | Looks for |
|---|------|-----------|
| 1 | `correctness` | logic errors, unhandled edge cases, error paths, races, resource leaks |
| 2 | `security` | injection, path traversal, unsafe deserialization, secrets, authz gaps, unsafe code |
| 3 | `performance` | hot-path allocation, quadratic work, blocking I/O on the UI/async thread, N+1, unbounded growth |
| 4 | `dry` | duplicated logic that has already drifted or will drift |
| 5 | `slop` | AI-shaped code: narrating comments, needless wrappers, swallowed errors, defensive noise, dead branches |
| 6 | `tech-debt` | dead code, stale TODO/FIXME, deprecated APIs, outdated deps, god files, missing tests on risky code |
| 7 | `best-practices` | violations of the project's own written rules, then language idioms |

## Arguments

Parse `$ARGUMENTS`:

- **Lens** (positional, default `next`): `next` picks the lens due in the rotation. `all` runs every lens in sequence (expensive; use on demand). A lens name runs that lens and records it in the rotation.
- `--repo PATH` — repository to scan. Default: the current working directory.
- `--scope` — what to read:
  - `changed` (default when this lens ran before): files changed since that lens's last run commit, plus their direct callers.
  - `hotspots` (default on a lens's first run): the 30 most-churned source files in the last 6 months (`git log --since=6.months --name-only --format= | sort | uniq -c | sort -rn`), excluding vendored, generated and lock files.
  - `full`: every tracked source file. Partition it across subagents.
- `--max N` — report at most N findings (default 10), ranked by severity then confidence.
- `--issues` — also open one GitHub issue per confirmed HIGH finding with `gh issue create`. Outward-facing: only with this flag, never inferred.

Unknown arguments: stop and list the valid ones.

## State

State lives outside the repo, so a scan never dirties the working tree:

```
~/.claude/bug-finder/<repo-slug>/
  state.json          # {"runs": {"<lens>": {"date": "YYYY-MM-DD", "commit": "<sha>"}}}
  findings.jsonl      # one line per reported finding: {id, lens, file, line, title, date, status}
  reports/YYYY-MM-DD-<lens>.md
```

`<repo-slug>` is the repo's top-level directory name plus the first 8 characters of `git rev-list --max-parents=0 HEAD | tail -1`, so two clones of one repo share state.

**Picking `next`:** the lens with no entry in `state.json` comes first (table order); otherwise the lens whose last run is oldest. With no state at all (a fresh cloud sandbox), use `lenses[day_of_year % 7]`, so a daily schedule still rotates.

## Run

1. **Resolve the repo.** `cd` to `--repo`; `ROOT=$(git rev-parse --show-toplevel)` or abort with "bug-finder needs a git repository". Record `HEAD` sha. Never switch branches, stash, or commit.
2. **Pick the lens and scope** as above. If `changed` resolves to zero files, say so, update the lens's run date, and stop: there is nothing new to look at.
3. **Load the project's rules.** Read `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, lint configs (`clippy.toml`, `.eslintrc*`, `ruff.toml`, `pyproject.toml` tool sections, `.golangci.yml`) and any architecture doc they link. These rules override generic advice: a pattern the project documents as deliberate is not a finding. Note project-specific bans (e.g. "non-test code never panics") — the `best-practices` lens checks them first, and every lens treats a violation as evidence.
4. **Run cheap tools first** when the toolchain has them, and treat output as leads, not findings: the linter at its strictest configured level, `cargo audit` / `npm audit` / `pip-audit` for `security` and `tech-debt`, `git grep -n -E 'TODO|FIXME|HACK|XXX'` for `tech-debt`. Skip any tool that is not installed; do not install anything.
5. **Hunt.** Split the scoped files into 2–4 partitions by directory and dispatch one `Agent` (`general-purpose`) per partition in a single message, so they run in parallel. Give each: the repo root, its file list, the lens's checklist and exclusions from `references/lenses.md`, the project rules from step 3, and this output contract:

   > Return JSON only: `[{"title", "file", "line", "severity": "HIGH|MEDIUM|LOW", "confidence": 0-100, "evidence": "<quoted code>", "failure_scenario": "<concrete input or state → wrong result>", "fix": "<one or two sentences>"}]`. Every finding must name a concrete failure scenario or a concrete cost. "Could be cleaner" without a cost is not a finding. Return `[]` if nothing qualifies. Read the code you cite; do not report from file names or grep hits alone.

   For a scope of 5 files or fewer, hunt directly without subagents.
6. **Verify.** Collect candidates, drop those under confidence 50, and merge duplicates. Dispatch one skeptic `Agent` per batch of up to 5 candidates with:

   > For each finding, try to prove it wrong: read the cited code and its callers, check whether a caller, type, guard, or test already prevents the failure, and whether the project rules call the pattern deliberate. Where cheap, prove it right instead: write a scratch test or run the code (in a temp dir, never committed). Return per finding: `{"title", "verdict": "CONFIRMED|PLAUSIBLE|REFUTED", "reason"}`.

   Keep CONFIRMED and PLAUSIBLE; drop REFUTED. Never report a finding no one re-read.
7. **Dedup against history.** Skip a finding whose `(file, title)` closely matches an `open` entry in `findings.jsonl`, unless the code at that location changed since. If a past entry's code is gone or fixed, mark it `fixed`.
8. **Write the report** to `reports/YYYY-MM-DD-<lens>.md` using `references/report-template.md`, append each reported finding to `findings.jsonl` with `status: "open"`, and set `state.json` `runs.<lens>` to today and the `HEAD` sha.
9. **`--issues`:** for each CONFIRMED HIGH finding, `gh issue create --title "[bug-finder/<lens>] <title>" --body <finding section>`. If `gh` is not authenticated, say so and skip; the report still stands.
10. **Print a summary** in the terminal: lens, scope and file count, findings by severity (each as `file:line — title`), refuted count, report path, and the lens due next. In an interactive session, offer `/fix-findings` to fix the HIGH and MEDIUM ones — the findings are now in the conversation.

`all` repeats steps 2–8 per lens and prints one combined summary.

## Rules

- Report-only. Never edit, format, or commit source in the target repo. Scratch tests live in the scratchpad or `$TMPDIR`.
- Severity is about consequence: HIGH = data loss, crash, security hole, or wrong output a user will hit; MEDIUM = a real defect under plausible conditions, or a cost that grows with use; LOW = maintainability with a named cost.
- Quote real code. A finding without `file:line` and quoted evidence is dropped.
- An empty report is a valid result. Do not pad to reach `--max`.

## Scheduling

Every run picks the next lens, so a plain recurring invocation rotates through all seven.

- **In an open session:** `/loop 24h /bug-finder next --repo /path/to/repo`.
- **Headless on this machine (cron or launchd):** `scripts/run-scheduled.sh /path/to/repo [extra args]` runs `claude -p` in the repo with read-mostly permissions and appends the summary to `~/.claude/bug-finder/cron.log`. Example crontab line, daily at 03:00:
  `0 3 * * * ~/.claude/skills/bug-finder/scripts/run-scheduled.sh /path/to/repo`
- **Cloud (`/schedule`):** a cloud routine clones the repo and sees only skills committed to it, not `~/.claude/skills`. Copy this folder to the repo's `.claude/skills/bug-finder/` first, then schedule the prompt `/bug-finder next --issues`. State does not persist between cloud runs, so rotation falls back to day-of-year and dedup relies on existing open issues; `--issues` is how cloud findings reach you.
