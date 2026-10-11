# lightreview

Turns a code change into an interactive review page. You get a severity-ranked diagram of the change, code and an explanation for each area, and an open-book quiz that walks you to every answer with hints.

## Use

In any git repo, in Claude Code:

```
/lightreview                 # diff against the default branch
/lightreview main
/lightreview 1234            # a GitHub PR
```

Claude reads the diff and writes `review.json`. `bin/build.mjs` checks the spec against the real diff and produces one self-contained `review.html`.

## How it works

1. Click an area in the diagram to see its code and explanation. Mark it reviewed. The quiz unlocks when every critical and high area is reviewed. Medium, low, and test areas (`kind: "test"`) are optional.
2. Take the quiz. It asks every question for the critical and high areas. You can answer at any time, and each question has a hint ladder:
   - **None**: just the question.
   - **Section**: the area's explanation.
   - **Code**: the area's code too.
   - **Answer**: the right choice and why.
3. A wrong answer is struck out and the hint moves up one level. Keep going until you find the right one.
4. There is no score. The end screen lists which hint each question needed, so you know what to reread.

Progress is saved in localStorage per spec. Keys: `n` jumps to the next unreviewed area, `d` toggles reviewed.

## Try it

```
node bin/build.mjs --spec example/review.json --diff example/change.diff --out example/review.html
open example/review.html
```

## Install the skill

```
ln -sfn "$PWD/skill/lightreview" ~/.claude/skills/lightreview
```
