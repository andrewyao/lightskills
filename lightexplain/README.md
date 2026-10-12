# lightexplain

Turns one concept in a codebase into an interactive explainer page. You get a diagram of the parts involved, an ordered reading path where each section pairs real code snippets with an explanation, and an open-book quiz that walks you to every answer with hints.

It is the sibling of [lightreview](../lightreview). lightreview teaches you a diff. lightexplain teaches you a concept in code that already exists.

## Use

In any repo, in Claude Code:

```
/lightexplain how requests are authenticated
/lightexplain the job retry flow
```

Claude traces the concept through the code and writes `explain.json`. `bin/build.mjs` reads every cited snippet from disk, checks it against the spec, and produces one self-contained `explain.html`.

## How it works

1. Read the sections in order, or click any box in the diagram. Each section has an explanation and the code it talks about, with the important lines highlighted. Mark it read. The quiz unlocks when every core and key section is read. Supporting and background sections are optional.
2. Take the quiz. It asks every question for the core and key sections. Each question has a hint ladder:
   - **None**: just the question.
   - **Section**: the section's explanation.
   - **Code**: the section's code too.
   - **Answer**: the right choice and why.
3. A wrong answer is struck out and the hint moves up one level. Keep going until you find the right one.
4. There is no score. The end screen lists which hint each question needed, so you know what to reread.

Progress is saved in localStorage per spec. Keys: `n` jumps to the next unread section, `d` toggles read.

## Snippets stay honest

Each snippet names a file, a line range, and an `anchor` string that must appear in that range. The build fails if a file is missing, a range is out of bounds, or the anchor isn't where the spec says. When the anchor is elsewhere in the file, the error gives its real line. The page records the repo commit and flags uncommitted edits in cited files.

## Try it

```
node bin/build.mjs --spec example/explain.json --root example --out example/explain.html
open example/explain.html
```

## Install the skill

```
ln -sfn "$PWD/skill/lightexplain" ~/.claude/skills/lightexplain
```
