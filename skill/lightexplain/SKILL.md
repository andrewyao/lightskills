---
name: lightexplain
description: Turn one concept in a codebase into an interactive explainer page. It has a diagram of the parts involved, an ordered reading path of sections that each pair real code snippets with an explanation, and an open-book quiz with a hint ladder that walks the reader to every answer. Use for /lightexplain, "explain how X works in this repo", "teach me the auth flow", or "help me understand this subsystem".
argument-hint: "<concept, e.g. 'how requests are authenticated'>"
---

# Light Explain

Build a page that teaches a reader one concept in the current codebase and then checks that they understood it. You write `explain.json`. `bin/build.mjs` reads every snippet from the real files, checks that each one says what you claim, and bakes everything into one HTML file. The page runs the reading path and the quiz offline.

The tool lives at `LIGHTEXPLAIN_HOME`, which is the directory two levels above this file (`skill/lightexplain/SKILL.md`). Resolve it with `readlink -f` on this skill's directory if it is symlinked.

## 1. Pin down the concept

The argument names the concept. If none was given, ask for one. A concept is something a reader can hold in their head: "how a request gets authenticated", "how the job queue retries", "what happens when a user saves a document". If the request is a whole subsystem ("explain the backend"), narrow it to the one flow that teaches the most and say so in `summary`.

## 2. Trace it in the code

Find the entry point, then follow the real runtime path: callers, callees, the data types passed between them, config that changes behavior, and the error paths. Read the code. Don't infer from names. Note where state lives and who mutates it. Note the non-obvious things: ordering constraints, invariants, caching, concurrency, and the failure modes. Those are what the explainer is for. An explanation that only restates the code is worthless.

Use subagents for the search if the concept spans many files, but read every snippet you cite yourself.

## 3. Shape the sections

A section is one unit of *understanding*, not one file. The `sections` array order is the reading order, so tell a story: entry point first, then each step in the order data flows, then the edges (errors, config, tests). Each section shows the snippets a reader needs and no more.

| Concept size | Sections |
|---|---|
| One module or function family | 3 to 5 |
| A flow across a few modules | 5 to 8 |
| A subsystem | 8 to 12. Group by stage and keep the reading path linear. |

Add a `concept` section with no snippets when the reader needs an idea that no single snippet shows, such as "every write goes through the outbox". Edges show runtime flow or dependency ("calls", "reads", "emits", "validates"). Keep them sparse enough to read.

**Snippets.** Keep each one to the part that matters, usually 5 to 40 lines. The build warns above 60. Use `focus` to highlight the 1 to 5 lines the explanation talks about. Give every snippet an `anchor`, a short string that must appear inside its range, such as the function signature. The build fails if it isn't there and tells you which line it is actually on. This catches miscounted line numbers.

## 4. Assign importance honestly

- **core**: the reader can't understand the concept without this. The entry point, the central data structure, the one invariant everything relies on. Most concepts have 1 to 3 core sections.
- **key**: real logic the reader must reason about. Branches, error handling, state changes, retries.
- **supporting**: worth a read. Wiring, config, the tests that pin the behavior.
- **background**: context. Types, helpers, history.

If everything is core, nothing is. Be stingy.

## 5. Write the questions

Questions are the point. The goal is knowledge, not a score. Each question has a hint ladder: none, then the section's explanation, then its code, then the answer and why. A wrong answer moves the hint up one level, so every reader ends up finding every answer. Write each question so a careful reader can answer it from the section's explanation or code.

- Ask about **behavior and consequences**. "What happens when X is null?" "If two requests arrive at once, how many hit the database?" "Which module would you change to add Y?"
- Prefer questions the reader will meet in real work: debugging a symptom, predicting a side effect, finding where to make a change.
- Never ask trivia such as "what is the variable called" or "which line is it on".
- Give 4 choices. Make the distractors plausible misreadings, such as a sensible but wrong design, the wrong module, or an off-by-one. Avoid choices that are obviously absurd.
- `explanation` is shown after the correct answer and at the answer hint. Write it as the insight behind the answer, in 1 to 3 sentences, and point at the specific line or function.
- Only core and key sections are quizzed, and every question for them is asked. The build enforces **2 or more questions per core or key section, and none for supporting or background sections**. Give each question its own point.

## 6. The spec

Write `explain.json` to the scratchpad:

```json
{
  "concept": "How requests are authenticated",
  "summary": "2-4 sentences: what the concept is, the shape of the flow, and the part readers most often get wrong.",
  "sections": [
    {
      "id": "middleware",
      "label": "requireAuth middleware",
      "kind": "function",
      "importance": "core",
      "summary": "One line shown under the title.",
      "explanation": "Paragraphs separated by blank lines. `code` and **bold** render. Lines starting with '- ' become a list. Explain what it does, why it is built this way, and what breaks if you change it.",
      "snippets": [
        {
          "file": "src/http/auth.ts",
          "lines": [12, 48],
          "anchor": "export function requireAuth",
          "focus": [30, 34],
          "note": "Optional caption shown above the code."
        }
      ]
    }
  ],
  "edges": [{ "from": "middleware", "to": "session-store", "label": "reads" }],
  "questions": [
    {
      "id": "q1",
      "sectionId": "middleware",
      "prompt": "A request arrives with an expired session cookie. What does requireAuth do?",
      "choices": ["Calls next() with req.user undefined", "Responds 401 and clears the cookie", "Refreshes the session", "Throws"],
      "answer": 1,
      "explanation": "Line 32 checks `expiresAt` before the user lookup and responds 401 with `Set-Cookie: session=; Max-Age=0`."
    }
  ]
}
```

`file` is relative to the repo root. `lines` is an inclusive 1-based range. Omit it to show the whole file, which only suits very small files. `focus` must lie inside `lines`. `kind` is free text, shown small above the label (`function`, `module`, `type`, `config`, `test`, `concept`). `answer` is a 0-based index into `choices`.

## 7. Build and fix until clean

```bash
node "$LIGHTEXPLAIN_HOME/bin/build.mjs" --spec "$SCRATCH/explain.json" --root "$(git rev-parse --show-toplevel)" --out "$SCRATCH/explain.html"
```

The build fails on a bad spec: missing files, paths outside the root, out-of-range lines, an anchor not in its range, focus outside the snippet, too few questions, a bad answer index, or a missing explanation. Fix the spec and rerun. Treat warnings (long snippets, sections with no code) as things to fix unless they are deliberate.

The page records the repo and commit it was built from, and flags uncommitted edits in the cited files.

## 8. Open it

`open "$SCRATCH/explain.html"` on macOS or `xdg-open` on Linux. Tell the user the path, the number of sections by importance, and which section to start with. Do not repeat the explanation in chat. The page is the explanation.

Progress is saved in the browser's localStorage per spec. Reopening the file resumes the session, and Reset clears it.
