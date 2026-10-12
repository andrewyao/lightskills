#!/usr/bin/env bash
# Run one bug-finder pass headlessly. For cron/launchd:
#   0 3 * * * ~/.claude/skills/bug-finder/scripts/run-scheduled.sh /path/to/repo [extra args]
set -euo pipefail

repo="${1:?usage: run-scheduled.sh /path/to/repo [bug-finder args]}"
shift
log_dir="$HOME/.claude/bug-finder"
mkdir -p "$log_dir"

# cron has a minimal PATH; claude, git and gh live in user locations.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$repo"
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') $repo ==="
  # Read-mostly: no Edit, and Bash limited to inspection and the audit tools.
  # Write is allowed so the report and state land in ~/.claude/bug-finder.
  claude -p "/bug-finder next --repo $repo $*" \
    --allowedTools "Read,Grep,Glob,Agent,Write,Bash(git:*),Bash(gh issue:*),Bash(cargo clippy:*),Bash(cargo audit:*),Bash(npm audit:*),Bash(pip-audit:*),Bash(ls:*),Bash(wc:*),Bash(mkdir:*),Bash(date:*)"
  echo
} >>"$log_dir/cron.log" 2>&1
