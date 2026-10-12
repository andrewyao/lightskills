# bug-finder

Hunts for defects in a repository through one lens per run: correctness, security, performance, DRY, slop, tech debt, or best practices. Each candidate finding goes to a skeptic agent that tries to refute it, and only the survivors land in a dated report. It never edits source.

## Use

In any git repo, in Claude Code:

```
/bug-finder                      # the lens due next in the rotation
/bug-finder security             # one specific lens
/bug-finder all --scope full     # every lens over every tracked file
```

Reports and rotation state live in `~/.claude/bug-finder/<repo-slug>/`, so a scan never dirties the working tree.

## Scheduling

Because each run picks the next lens, a recurring run covers all seven over a week:

- In a session: `/loop 24h /bug-finder next --repo /path/to/repo`
- From cron: `0 3 * * * ~/.claude/skills/bug-finder/scripts/run-scheduled.sh /path/to/repo`

See [SKILL.md](skill/bug-finder/SKILL.md) for arguments, the lens checklists, and cloud scheduling.
