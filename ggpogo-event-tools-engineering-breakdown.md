# GGPoGo Event Tools — Engineering Breakdown

A running log of detailed, process-level engineering notes for Event Tools work sessions — tooling decisions, debugging detail, and reasoning that's too granular for `ggpogo-event-tools-CHANGELOG.md` (which is feature/user-facing) but useful to have on record for the next session. Newest entries appended at the bottom, oldest at top is not assumed — check each entry's date header.

---

## Session: 2026-07-18 → 2026-07-19 — `/predeliver` skill creation, skill refinement, and the v2.14.1 sanitizer-fix delivery

**Scope:** Built the `/predeliver` skill, ran it against the live `event-tools.html` (v2.14.0), refined one of its checks based on a false-positive found during that run, then fixed all 7 flagged issues and shipped v2.14.1.

**Companion docs:** `.claude/skills/predeliver/SKILL.md`, `ggpogo-event-tools-CHANGELOG.md` (v2.14.1 entry), `CLAUDE.md` (source of the 9-point checklist this skill encodes).

---

### 1. Background — why this session happened

`CLAUDE.md` has carried a 9-item pre-delivery checklist for a while (WordPress Custom HTML sanitizer traps, Babel CDN pinning, Firebase auth constraints). It had been applied manually on each delivery. This session turned it into a repeatable skill (`/predeliver`) so it can be invoked consistently, then immediately used it — which is how it caught real issues sitting in the v2.14.0 delivery that had gone out without being run against this specific tooling.

---

### 2. The `/predeliver` skill

Created at `.claude/skills/predeliver/SKILL.md`. It is a **grep-based, report-only** skill — it never auto-fixes, per explicit instruction in the skill body ("Do not attempt to auto-fix. This skill reports, Eric fixes."). It runs all 9 CLAUDE.md checks against a target file (default `event-tools.html`) and emits a pass/fail table, blocking delivery on any hard failure (✗).

**The 9 checks**, in brief:
1. Zero raw `&&` (WordPress sanitizer corrupts it to `&#038;&#038;`)
2. Zero raw `@` in JS strings (throws `SyntaxError` after certain corruption paths)
3. Zero `confirm()` calls (must use the `useConfirm` hook)
4. `APP_VERSION` present (value reported for manual bump confirmation, not auto-verified)
5. Babel Standalone `@7.29.7` pin present
6. `data-presets="react"` present
7. `/** @jsxRuntime classic */` present, ideally first line of the script block
8. URL-construction heuristic (advisory only, never blocks)
9. Zero `signInWithRedirect` (requires Firebase Hosting, which isn't deployed)

A stray duplicate `SKILL.md` was also found sitting untracked at the repo root (not inside `.claude/skills/`, so not actually registered as a skill). By the time it was investigated it had already been removed outside this session — no action was needed.

---

### 3. First `/predeliver` run — findings against v2.14.0

Running the skill cold against the live `event-tools.html` (`APP_VERSION = "v2.14.1"` did not exist yet; the file was on `v2.14.0`) surfaced:

| # | Check | Result |
|---|---|---|
| 1 | No raw `&&` | ✗ — 4 hits |
| 2 | No raw `@` in JS strings | ✗ — hits found, see below |
| 3–9 | All other checks | ✓ / ⚠ (advisory only, no blockers) |

**The `&&` hits (all pre-existing in v2.14.0, not introduced this session):**
- `item.type === "giveaway" && item.status === "claimed"` — My Activity item ternary (claimed-giveaway label)
- `item.type === "giveaway" && item.status === "picked_not_claimed"` — same ternary chain, second branch
- `hasTime && hasLocation` — `DrawingInfoAlert`'s time/location separator (`·`)
- `outgoing && outgoing.uid && outgoing.activityRecordId` — `reroll()`'s guard before patching the outgoing entrant's My Activity record

**The `@` hits** split into two categories once checked against the skill's exclusion list (CDN version pins, the `@jsxRuntime` pragma, HTML comments):
- **Real hits:** two raw `@` inside JSX text ("Claimed [prize] `@` [time]" / "Picked as winner `@` [time]") and one inside a template literal (`` `@${winner.name} you won...` `` in `buildAnnouncement`)
- **False-positive-shaped hits:** two occurrences sitting inside `//` line comments that just happened to reference the same "`@` [time]" wording in prose, describing what the UI shows — not executable, so they can't throw a `SyntaxError`.

That second category exposed a gap in the skill as originally written.

---

### 4. Skill refinement — excluding JS comments from check 2

The skill's check 2 exclusion list, as first written, only excluded **HTML comments** (`<!-- ... -->`), not JS comments (`//`, `/* ... */`) — an inconsistency, since check 3 (`confirm()`) already explicitly excludes JS comments and the underlying failure mode (raw `@` causing a `SyntaxError`) genuinely cannot occur inside a `//` or `/* */` comment; the sanitizer corrupting text inside a comment is cosmetic at worst, not a parse error.

**Fix applied** (`.claude/skills/predeliver/SKILL.md`, check 2's exclusion list):
```diff
 - `@jsxRuntime` inside the pragma comment
 - `@babel/standalone` in the CDN URL (script tag `src`)
 - `@7.29.7` (Babel version pin)
 - Any hit inside HTML comments `<!-- ... -->`
+- Any hit inside JS comments (single-line `//` or multi-line `/* ... */`)
```

Committed as `e4f8db4` — *"Exclude JS comments from predeliver check 2's raw @ scan."* This was done as its own isolated commit, separate from the later content fixes, since it's a tooling change rather than an Event Tools app change.

---

### 5. Fixing the 3 real `@` hits and 4 `&&` hits in `event-tools.html`

All four fixes followed **Eric's stated preference: nested `if` statements or intermediate variables, not `&&` chains** — including inside JSX, where a raw ternary condition needed to be replaced instead of just reformatted.

**a) My Activity item labels** (`group.items.map((item, i) => (...))`)
This was an implicit-return arrow function (parens, not braces), so there was nowhere to place a nested `if` ahead of the JSX. Converted it to a block-bodied arrow function (`=> { ... return (...); }`) specifically so two intermediate booleans could be computed up front:
```js
let isClaimedGiveaway = false;
if (item.type === "giveaway") {
  if (item.status === "claimed") isClaimedGiveaway = true;
}
let isPickedNotClaimed = false;
if (item.type === "giveaway") {
  if (item.status === "picked_not_claimed") isPickedNotClaimed = true;
}
```
The JSX ternary then reads `{isClaimedGiveaway ? (...) : isPickedNotClaimed ? (...) : null}` — same rendered output, zero raw `&&`.

**b) `DrawingInfoAlert`'s separator** — already had a block body (`function DrawingInfoAlert({ c, session, authUser }) { ... return (...); }`), so this was a straight insertion of one intermediate variable ahead of the existing `return`:
```js
let hasTimeAndLocation = false;
if (hasTime) {
  if (hasLocation) hasTimeAndLocation = true;
}
```

**c) `reroll()`'s outgoing-entrant guard** — converted the triple-`&&` `if` into three nested `if`s wrapping the same body, closing with two additional `}`.

**d) The two raw `@` in JSX text** ("Claimed [prize] `@` [time]", "Picked as winner `@` [time]") — raw `@` inside JSX children can't take a `\uXXXX` escape directly (JSX text isn't a JS string; backslash sequences render literally rather than being interpreted), so each was wrapped as its own JS string expression: `{"\u0040"}` in place of the bare `@` character, dropped in as its own interpolated JSX child between the surrounding text nodes.

**e) The raw `@` in `buildAnnouncement`'s template literal** — this one *is* a JS string context (a template literal), so the fix was a direct in-place substitution: `` `@${winner.name}...` `` → `` `\u0040${winner.name}...` ``.

---

### 6. A tooling gotcha worth recording: double-escaping `@` via the Edit tool

Getting `@` to land correctly in the file took several attempts and is worth documenting so it doesn't cost time again.

- The Edit tool's parameters pass through **no additional escaping layer** on this end — whatever backslash sequence appears in the `old_string`/`new_string` text is written to the file **verbatim**, character for character.
- First attempt: wrote `\\u0040` intending "one literal backslash" (reflexively over-escaping, as if targeting a JSON string). Result: the file ended up with **two literal backslashes** (`\\u0040`), which as JS source is a string containing an escaped backslash followed by the literal characters `u0040` — not the unicode escape at all.
- Correcting *that* required directly reasoning about what a **single, literal backslash character** in the file requires as tool input: type `\u0040` with exactly one backslash, no extra escaping — the level of escaping that looks "safe" by habit is actually one too many here.
- The Edit tool itself became unreliable for this specific single-character-different change (a same-old-string/new-string false match kept firing, apparently from copy-paste habit defaulting back to the wrong escaping), so the actual fix for the template literal and the wording in the changelog comment were both applied via a **PowerShell `[System.IO.File]` read/replace/write**, constructing the backslash explicitly via `[char]92` to remove any ambiguity about what was actually being written.
- **Lesson for next time:** when a fix requires literally writing a backslash-escape sequence into a file (`@`, `\n` inside a string meant to stay as source text, etc.), verify the actual bytes with `Read` (not `grep`, which can visually normalize backslashes in terminal output) immediately after the edit, before assuming it's correct.

---

### 7. New convention established: in-file changelog header

`CLAUDE.md`'s delivery-format section calls for an "in-file changelog header" showing only the latest version's changes. No such header existed anywhere in the live `event-tools.html` prior to this session — the file has only ever carried the version-number footer (`APP_VERSION`) plus scattered inline `//` comments tagged with version numbers at the specific lines they touched.

Rather than assume where a pre-existing header lived (there wasn't one) or silently invent a permanent new structural pattern without flagging it, this session added a single **HTML comment block at the very top of the file** (before `<div id="ggpogo-event-tools-root">`) summarizing only the v2.14.1 changes, and called this out explicitly in the handoff so Eric can confirm whether that's the right home for it going forward, or whether it should be dropped/moved.

```html
<!--
  v2.14.1 — pre-delivery sanitizer fixes
  Rewrote 4 raw double-ampersand occurrences (My Activity item labels, DrawingInfoAlert,
  reroll's outgoing-entrant patch) as nested `if`/intermediate variables, and
  encoded 3 raw `@` occurrences (My Activity item labels, buildAnnouncement)
  as the "\u0040" escape. No functional changes. Full history: ggpogo-event-tools-CHANGELOG.md
-->
```

Note the comment itself had to avoid the literal token `&&` in its own prose (written as "double-ampersand occurrences" instead) — otherwise `/predeliver`'s check 1, which greps the whole file rather than scoping strictly to the executed `<script>` block, would flag its own documentation as a hard failure. Worth keeping in mind for future in-file notes: don't describe the `&&`/`@` bugs using the literal characters that trigger the checks about them.

---

### 8. Version bump and changelog

- `APP_VERSION` bumped `"v2.14.0"` → `"v2.14.1"` (`event-tools.html`)
- Appended a `### v2.14.1` entry to `ggpogo-event-tools-CHANGELOG.md` describing the fix set as "no functional changes" — this release is a pure sanitizer-safety pass, no user-visible behavior changed.

---

### 9. Final verification

Re-ran all 9 checks after the fixes (plus one follow-up fix — see below):

| # | Check | Result |
|---|---|---|
| 1 | No raw `&&` | ✓ 0 hits |
| 2 | No raw `@` in JS strings | ✓ 0 hits (remaining `@` all legitimate: CDN pins, CSS, pragma, HTML/JS comments) |
| 3 | No `confirm()` | ✓ |
| 4 | `APP_VERSION` | ✓ `v2.14.1` |
| 5 | Babel `@7.29.7` pin | ✓ |
| 6 | `data-presets="react"` | ✓ |
| 7 | JSX classic pragma | ✓ first line |
| 8 | URL construction (advisory) | ⚠ one flag at the `"?" + params.toString()` line — reviewed, uses `URLSearchParams`, looks fine |
| 9 | No `signInWithRedirect` | ✓ |

**One follow-up catch:** the first "clean" re-run still showed one `&&` hit — inside the new changelog HTML comment itself (section 7's comment, in its first draft, described "4 raw `&&` occurrences" using the literal characters). Reworded to "double-ampersand" to get a genuinely zero-hit result. This is the failure mode called out at the end of section 7 above.

Status at end of session: **READY FOR DELIVERY**, file uncommitted at repo root pending Eric's decision on whether/when to commit and deploy.

---

### 10. File manifest (this session)

- `.claude/skills/predeliver/SKILL.md` — new skill; later refined (JS-comment exclusion on check 2)
- `event-tools.html` — `APP_VERSION` v2.14.0 → v2.14.1; 4 `&&` + 3 `@` fixes; new in-file changelog header
- `ggpogo-event-tools-CHANGELOG.md` — v2.14.1 entry appended
- `ggpogo-event-tools-engineering-breakdown.md` — this file (new)

**Commits made this session:**
- `e4f8db4` — Exclude JS comments from predeliver check 2's raw @ scan

**Not yet committed:** the v2.14.1 `event-tools.html` fixes, the CHANGELOG entry, and this breakdown doc — pending Eric's go-ahead.
