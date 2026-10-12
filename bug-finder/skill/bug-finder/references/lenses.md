# Lenses

Each lens has a checklist (what to look for) and exclusions (what is not a finding). Hand both to the hunters. A finding needs a concrete failure scenario or a named cost.

## 1. correctness

Look for:
- Off-by-one, inverted conditions, wrong operator, wrong variable in a copy-pasted branch.
- Edge inputs: empty, zero, negative, max-size, NaN/inf, unicode, missing optional, duplicate keys.
- Error paths: errors swallowed, logged-and-continued into corrupt state, partial writes without rollback, cleanup skipped on early return.
- State: stale caches, invalidation missed on one path, state machines with an unhandled transition.
- Concurrency: check-then-act races, shared mutation without a lock, lock order inversions, poisoned/abandoned locks, async tasks dropped or never awaited.
- Resources: leaked file handles, unbounded queues, temp files never removed.
- Arithmetic: integer overflow, lossy casts, float equality, division by a value that can be zero.
- Time: timezone and DST assumptions, monotonic vs wall clock.

Not a finding: style; a guard that a caller or the type system already makes unreachable (prove the caller); behavior the tests explicitly pin as intended.

## 2. security

Look for:
- Injection: shell, SQL, path, format string, HTML/JS (XSS), template, regex (ReDoS).
- Untrusted input: lengths/offsets from files or the network used to index or allocate without bounds; recursion without a depth limit; zip/tar path traversal; symlink escape.
- Deserialization of untrusted data into rich types; `eval`-like execution.
- Secrets in code, logs, error messages, or committed config; tokens taken from argv where other users can read them.
- AuthN/AuthZ: missing checks on one route, confused deputy, TOCTOU on permission checks.
- Crypto: homemade crypto, weak hashes for security, non-constant-time comparison of secrets, predictable randomness for tokens.
- `unsafe` / FFI: missing or wrong SAFETY reasoning, lifetimes escaping, unchecked null.
- Dependencies with known advisories (from `cargo audit` / `npm audit` / `pip-audit`).

Not a finding: theoretical attacks with no path from an attacker-controlled input; issues in test-only code; dev-only tooling with no untrusted input.

## 3. performance

Look for:
- Work in a hot path (render loop, per-pixel, per-request, per-item) that could move out: allocation, clone, regex compile, lookup in a list instead of a map, logging formatting.
- Quadratic or worse behavior on input that grows with user data.
- Blocking I/O, locks, or heavy CPU on a UI thread or async executor.
- N+1 queries or repeated file/network reads that could batch or cache.
- Unbounded growth: caches without eviction, vectors that only grow, listeners never removed.
- Redundant work: decoding at full size then downscaling, recomputing an unchanged value every frame.
- Wasted parallelism: serial loops over independent work that is large; or oversubscription.

Not a finding: micro-optimizations off the hot path; anything without an estimate of the cost (state the input size where it hurts). Say "measure first" when the cost is uncertain and mark confidence accordingly.

## 4. dry

Look for:
- The same logic in two or more places where the copies have already drifted (one has a fix the other lacks) — this is the HIGH case.
- Parallel lists that must stay in step (enum + match arms + string table + docs) with no single source.
- Constants or magic numbers repeated across files.
- Near-identical functions differing by one parameter.

Not a finding: two similar lines; duplication across a deliberate boundary (lib vs app, platform branches, test fixtures); a shared helper that would need more parameters than the duplicated code has lines.

## 5. slop

AI-shaped or careless code that costs readers or hides bugs. Look for:
- Comments that narrate the next line, restate the name, or describe a change ("now uses X", "updated to") instead of a why.
- Wrappers with one caller that only forward arguments; abstractions with one implementation and no second in sight.
- Defensive noise: null checks on non-null types, try/catch that swallows or re-wraps without context, fallback values that silently mask a failed operation.
- Dead branches, unused parameters, `_unused` variables, commented-out code.
- Verbose re-implementations of standard library functions.
- Inconsistent naming or idiom against the surrounding file.
- Tests that assert nothing meaningful (only "does not throw", or mirror the implementation).

Not a finding: a comment that explains why; a documented deliberate pattern (check project rules and memory notes such as "spike code stays").

## 6. tech-debt

Look for:
- Dead code: reachable only from tests, or from nowhere, on every build target.
- TODO/FIXME/HACK older than 6 months (`git blame` the line) or pointing at an issue that is closed.
- Deprecated APIs and compiler/linter deprecation warnings.
- Dependencies several majors behind, unmaintained, or duplicated at two versions in the lockfile.
- God files (well above the repo's median size) or functions with deep nesting that keep attracting bug fixes (check `git log` for the file).
- Risky code with no tests: parsers, file writers, migrations, money/data paths.
- Feature flags or compatibility shims whose condition is always true now.

Not a finding: size alone without churn or bug history; deliberate vendoring.

## 7. best-practices

First, check the project's own written rules (from CLAUDE.md, AGENTS.md, CONTRIBUTING, lint config) against the scoped code — every violation is a finding, quoted with the rule. Then:
- Language idioms the project's lint level would flag at a stricter setting.
- Error types: stringly-typed errors, losing the source error, panics/exceptions for expected failures.
- Public API: leaking internal types, missing validation at the boundary, validation duplicated deep inside.
- Tests: no regression test for a past bug fix (check `git log --grep=fix` against test changes).
- Docs that contradict the code.

Not a finding: preferences the project does not state and the language community does not agree on.
