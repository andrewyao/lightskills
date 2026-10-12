# lightskills
A set of small claude code skills that are useful to me

- [lightreview](lightreview): turn a code change into an interactive review page with an open-book quiz.
- [lightexplain](lightexplain): turn one concept in a codebase into an interactive explainer page with an open-book quiz.
- [bug-finder](bug-finder): audit a repo through one rotating lens per run and write a verified, report-only list of findings.

Install a skill by symlinking it into `~/.claude/skills`, for example:

```sh
ln -sfn "$PWD/lightreview/skill/lightreview" ~/.claude/skills/lightreview
ln -sfn "$PWD/lightexplain/skill/lightexplain" ~/.claude/skills/lightexplain
ln -sfn "$PWD/bug-finder/skill/bug-finder" ~/.claude/skills/bug-finder
```
