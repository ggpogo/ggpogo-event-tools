---
name: predeliver
description: Run the Event Tools pre-delivery checklist. Grep-based validation for the 9 WordPress sanitizer / Babel / Firebase traps documented in CLAUDE.md. Invoke before every Event Tools HTML delivery, or on demand for spot-checks. Optional argument — path to the file to check (default `event-tools.html` at repo root).
---

# Event Tools pre-delivery checklist

Validates the target HTML file against the 9 checks from CLAUDE.md. Reports pass/fail as a markdown table. **Any hard failure (✗) blocks the delivery** — surface the failures, do not proceed with handoff until they're fixed.

## When invoked

1. Determine target file. Default: `event-tools.html` at repo root. If a filename argument was passed, use that.
2. Verify the file exists. If not, report and stop.
3. Read the file into memory.
4. Run each check below. Record ✓ (pass), ✗ (hard fail), or ⚠ (advisory) with a one-line note.
5. Emit the summary table (format below).
6. If any check is ✗: state `BLOCKED — fix failures above before delivery` and stop.
7. If all ✓ or ⚠: state `READY FOR DELIVERY` and report the `APP_VERSION` value prominently for Eric to confirm the bump.

## The checks

### 1. Zero raw `&&` in the script block (hard fail)

Grep the file for `&&`. Expected count: 0.

WordPress sanitizer corrupts `&&` → `&#038;&#038;`. Use nested `if` statements instead.

Report count and, if > 0, first three line numbers.

### 2. Zero raw `@` in JS string literals (hard fail)

Grep for `@`. Exclude legitimate matches:

- `@jsxRuntime` inside the pragma comment
- `@babel/standalone` in the CDN URL (script tag `src`)
- `@7.29.7` (Babel version pin)
- Any hit inside HTML comments `<!-- ... -->`
- Any hit inside JS comments (single-line `//` or multi-line `/* ... */`)

Remaining hits fail. Report line numbers.

Raw `@` in JS strings throws SyntaxError. Encode as `\u0040`.

### 3. Zero `confirm()` calls (hard fail)

Grep for `\bconfirm\s*\(`. Exclude occurrences inside single-line `//` or multi-line `/* */` comments.

Any remaining hit fails. Use the `useConfirm` hook instead.

### 4. `APP_VERSION` present (hard fail if missing)

Grep for `const APP_VERSION\s*=\s*["']([^"']+)["']`. Extract the value.

Missing → hard fail.
Present → ✓, and **report the value prominently**. This skill cannot confirm the bump is correct without external context; Eric visually confirms the version was incremented from the last delivery.

Bonus: run `git log --oneline -5` to give Eric a visual reference for the previous delivery.

### 5. Babel pin present (hard fail)

Grep for `babel/standalone@7.29.7`. Expected: at least one match.

Missing pin fails. Unpinned CDN reference is silent breakage.

### 6. `data-presets="react"` present (hard fail)

Grep for `data-presets="react"`. Expected: at least one match on a Babel script tag.

Missing fails.

### 7. JSX classic runtime pragma present (hard fail if missing, warn if misplaced)

Grep for `/\*\* @jsxRuntime classic \*/`.

Missing → hard fail.
Present but not on the first line of the transformed script block → ⚠ (warning, not blocking).
Present on first line → ✓.

### 8. URL construction heuristic (advisory only)

Flag suspicious patterns for manual review — do not hard-fail:

- `+ '&'` (string concatenation with `&`)
- Template literals containing `` `&${` ``
- `'?' +` or `"?" +` followed by a variable

Legitimate uses exist (e.g. building a display string, not a URL). Report line numbers as ⚠ so Eric can eyeball. Only fail if Eric explicitly confirms a match is a URL construction bug.

### 9. Zero `signInWithRedirect` (hard fail)

Grep for `signInWithRedirect`. Expected count: 0.

Any hit fails. Redirect requires Firebase Hosting deployment which is not present on this project. Use `signInWithPopup` only.

## Output format

```
Pre-delivery checklist — <filename>
APP_VERSION: <value>

| # | Check | Result | Note |
|---|---|---|---|
| 1 | No raw `&&` | ✓ | 0 hits |
| 2 | No raw `@` in JS strings | ✗ | 2 hits: L442, L1290 |
| 3 | No `confirm()` calls | ✓ | 0 hits |
| 4 | APP_VERSION present | ✓ | v2.13.4 — CONFIRM BUMP |
| 5 | Babel @7.29.7 pin | ✓ | Present |
| 6 | data-presets="react" | ✓ | Present |
| 7 | JSX classic pragma | ✓ | Present, first line of script block |
| 8 | URL construction (heuristic) | ⚠ | 1 flag: L823 — review manually |
| 9 | No signInWithRedirect | ✓ | 0 hits |

Status: BLOCKED — check 2 failed. Encode `@` as `\u0040` at L442 and L1290 before delivery.

Previous commits (for APP_VERSION comparison):
9956695 Add CLAUDE.md project working guide
c15fb51 Archive wordpress-block.html
...
```

## Notes for the skill

- Checks 1, 3, 5, 6, 9 are pure grep — hard fail on any bad hit.
- Check 2 requires excluding legitimate `@` occurrences before deciding.
- Check 4 reports value; Eric confirms bump.
- Check 7 has one soft edge (positional).
- Check 8 is advisory only — never blocks. Multiple false positives per delivery are expected.
- After a ✗ result, list the specific line numbers so Eric can jump straight to the fix.
- Do not attempt to auto-fix. This skill reports, Eric fixes.
