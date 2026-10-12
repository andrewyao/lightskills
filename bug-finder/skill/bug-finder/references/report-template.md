# bug-finder: <lens> — <repo> @ <short sha>

<YYYY-MM-DD> · scope: <changed|hotspots|full> (<N> files) · <K> findings (<h> HIGH, <m> MEDIUM, <l> LOW) · <r> refuted

## Findings

### BF-<lens>-<YYYYMMDD>-<n>. <title>

- **Where:** `path/to/file.ext:LINE`
- **Severity / verdict:** HIGH · CONFIRMED (confidence 85)
- **Failure scenario:** <concrete input or state → wrong result, or the named cost>
- **Evidence:**
  ```<lang>
  <quoted code, 3–10 lines>
  ```
- **Fix:** <one or two sentences>
- **Verifier:** <why it survived refutation; the scratch test or run that proved it, if any>

(repeat per finding, HIGH first)

## Refuted

- `<file:line>` <title> — <why it was wrong>

## Leads not pursued

- <tool output or partial lead that did not reach a finding, one line each; omit the section if empty>

Next lens due: <lens>
