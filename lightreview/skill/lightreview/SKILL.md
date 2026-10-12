---
name: lightreview
description: Turn a code change into an interactive review page. It has a severity-ranked diagram of the change, per-area code and explanations, and an open-book quiz with a hint ladder that walks the reviewer to every answer. Use for /lightreview, "help me review this diff/PR/branch", or "make this change easy to understand".
argument-hint: "[base-ref | PR number]"
---

# Light Review

Build a page that teaches a reviewer one code change and then checks that they understood it. You write `review.json`. `bin/build.mjs` checks it against the real diff and bakes it into one HTML file. The page runs the review and the quiz offline.

The tool lives at `LIGHTREVIEW_HOME`, which is the directory two levels above this file (`skill/lightreview/SKILL.md`). Resolve it with `readlink -f` on this skill's directory if it is symlinked.

## 1. Get the diff

- A base ref was given: `git diff <base>...HEAD`.
- A PR number was given: `gh pr diff <n> > "$SCRATCH/change.diff"`.
- Nothing was given: diff against the merge base with the default branch. If there are uncommitted changes, use `git diff HEAD` instead.

Save the diff to a file in the scratchpad and pass it with `--diff` so the build sees exactly what you read. Read the whole diff, then open the surrounding code for anything whose effect you can't tell from the hunk alone. Callers, types, and config are the usual suspects. An explanation that only restates the diff is worthless.

## 2. Size the diagram to the change

Count changed lines (`+` and `-`):

| Changed lines | Areas (nodes) |
|---|---|
| under 50 | 2 to 4 |
| 50 to 300 | 4 to 8 |
| 300 to 1000 | 8 to 14 |
| over 1000 | 12 to 20. Group by subsystem and merge mechanical edits into one area. |

An area is a unit of *understanding*, not a file. Split one file into two areas when it does two separate things. Merge renames and import churn across ten files into one `low` area. Add a `concept` node with no hunks when the reviewer needs an idea that no single hunk shows, such as "the cache is now write-through". Edges show runtime flow or dependency ("calls", "writes", "replaces", "validates"). Edges must stay sparse enough to read.

## 3. Assign severity honestly

- **critical**: wrong understanding here ships a bug, data loss, a security hole, or a broken contract. It covers behavior changes on hot paths, concurrency, auth, migrations, and public API changes. Most changes have 0 to 2 critical areas.
- **high**: real logic the reviewer must reason about. New branches, error handling, state changes.
- **medium**: supporting changes worth a read. Wiring, new tests, config.
- **low**: mechanical. Renames, formatting, generated code, import moves.

If everything is critical, nothing is. Be stingy.

## 4. Write the questions

Questions are the point. The goal is knowledge, not a score. Each question has a hint ladder: none, then the area's explanation, then its code, then the answer and why. A wrong answer moves the hint up one level, so every reviewer ends up finding every answer. Write each question so it can be answered from the area's explanation or code by reading carefully.

- Ask about **behavior and consequences**. "After this change, what happens when X is null?" "Which caller now has to handle Y?" "Why does Z need the lock now?"
- Never ask trivia such as "what is the new variable called" or "how many lines changed".
- Give 4 choices. Make the distractors plausible misreadings of the change, such as the old behavior, an off-by-one, or the wrong caller. Avoid choices that are obviously absurd.
- `explanation` is shown after the reviewer answers correctly and at the answer hint. Write it as the insight behind the answer, in 1 to 3 sentences, and point at the specific line or function.
- Only critical and high areas are quizzed, and every question for them is asked. The build enforces **2 or more questions per critical or high area, and none for medium or low areas**. Give each question its own point. Don't ask the same thing twice in different words.

## 5. The spec

Write `review.json` to the scratchpad:

```json
{
  "title": "Short name of the change",
  "summary": "2-4 sentences: what changed, why, and what the reviewer should worry about most.",
  "nodes": [
    {
      "id": "retry-loop",
      "label": "Retry loop in fetchWithBackoff",
      "kind": "function",
      "severity": "critical",
      "summary": "One line shown under the title.",
      "explanation": "Paragraphs separated by blank lines. `code` and **bold** render. Lines starting with '- ' become a list. Explain what it did before, what it does now, and why it matters.",
      "hunks": [{ "file": "src/net/fetch.ts", "lines": [40, 88] }]
    }
  ],
  "edges": [{ "from": "retry-loop", "to": "metrics", "label": "emits" }],
  "questions": [
    {
      "id": "q1",
      "nodeId": "retry-loop",
      "prompt": "A request fails with 429 three times. What does fetchWithBackoff do on the fourth failure?",
      "choices": ["Retries again", "Throws RateLimitError", "Returns the cached value", "Returns null"],
      "answer": 1,
      "explanation": "maxAttempts is now 3 (line 52), so the fourth failure throws instead of retrying. Before this change it retried forever."
    }
  ]
}
```

`kind` is free text, shown small above the label (`function`, `module`, `schema`, `test`, `config`, `concept`). Use `test` for every area that only changes tests: the first quiz unlocks once all critical and high areas are reviewed, and test areas never block it. `hunks[].lines` is a range in the **new** file. Omit `lines` to attach every hunk in that file. `answer` is a 0-based index into `choices`.

## 6. Build and fix until clean

```bash
node "$LIGHTREVIEW_HOME/bin/build.mjs" --spec "$SCRATCH/review.json" --diff "$SCRATCH/change.diff" --out "$SCRATCH/review.html"
```

The build fails on a bad spec: unknown files, ranges that match no hunk, too few questions, a bad answer index, or a missing explanation. Fix the spec and rerun. It warns about hunks not mapped to any area. Map each one, or fold it into a `low` area. Leave a hunk unmapped only if it is pure noise, such as a lockfile.

## 7. Open it

`open "$SCRATCH/review.html"` on macOS or `xdg-open` on Linux. Tell the user the path, the number of areas by severity, and which critical areas to start with. Do not summarize the whole change in chat. The page is the review.

Progress is saved in the browser's localStorage per spec. Reopening the file resumes the session, and Reset clears it.
