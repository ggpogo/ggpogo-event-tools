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

*(Everything above was in fact committed and pushed shortly after this was written, across three commits: `fd41b14` CLAUDE.md conventions, `90d79e9` the v2.14.1 release, `b4bc927` the site-styles v1.5.1 release, followed by `0edb5cd` backfilling the v1.5.0 changelog entry. See the next session below for what happened when v2.14.1 actually went live.)*

---

## Session: 2026-07-19 (same day) — v2.14.2 hotfix: v2.14.1 broke the live page

**Scope:** Eric deployed v2.14.1 to WordPress; the live page went blank. Root-caused, fixed, verified with an actual Babel parse (not just grep), and shipped v2.14.2.

**Companion docs:** `ggpogo-event-tools-CHANGELOG.md` (v2.14.2 entry), this file's own v2.14.1 section above (section 5a describes the change that introduced the bug).

---

### 1. What happened

v2.14.1 (committed `90d79e9`, described above) passed all 9 `/predeliver` checks and was reported "READY FOR DELIVERY." Eric pasted it into the WordPress Custom HTML block. The live page rendered completely blank — no error, no partial UI, nothing.

### 2. Root cause

Section 5a of the v2.14.1 write-up above describes converting the My Activity list's `group.items.map((item, i) => (...))` callback from an **implicit-return** arrow function (parens, no braces) to a **block-bodied** one, so that two intermediate variables (`isClaimedGiveaway`, `isPickedNotClaimed`) could be computed ahead of the JSX:

```js
// before (v2.14.0, implicit return):
{group.items.map((item, i) => (
  <div key={item.id} ...>
    ...
  </div>
))}

// after (v2.14.1, intended):
{group.items.map((item, i) => {
  let isClaimedGiveaway = false;
  ...
  return (
    <div key={item.id} ...>
      ...
    </div>
  );
})}
```

The **opening** of the callback was correctly changed (`=> (` → `=> {`, plus the added `return (`). The **closing** was not — it was left as the original `))}` (one `)` to close the JSX parens, one `)` to close `.map(`, one `}` to close the outer JSX expression container). That closing shape is only valid for the old implicit-return version. The new block-bodied version needed `);` (close the `return (...)`) then `}` (close the arrow function's block body) then `)` then `}` — one more closing brace than before.

The result was a genuine JS syntax error sitting inside the `<script type="text/babel">` block. Babel Standalone failed to parse the entire script — not just that one component — so **nothing in the app rendered**, matching the blank-page failure signature already documented for the v2.10.0 incident (unpinned Babel CDN) in `ggpogo-event-tools-CHANGELOG.md`. No console-visible React error, no partial UI: a parse failure at the top level takes the whole IIFE down before any component ever mounts.

### 3. Why `/predeliver` didn't catch it

All 9 of `/predeliver`'s checks (`.claude/skills/predeliver/SKILL.md`) are **regex/grep-based pattern matches against known failure modes** — raw `&&`, raw `@`, `confirm()`, `APP_VERSION` presence, the Babel pin, `data-presets`, the pragma, a URL-construction heuristic, and `signInWithRedirect`. **None of them parse the file as JavaScript.** A structural mistake like a mismatched brace is invisible to every one of those checks — the skill reported a clean bill of health while shipping a file that couldn't execute at all. This is a real gap distinct from the sanitizer-specific traps the skill was built to catch.

### 4. The fix, and how it was verified this time

Fixed by closing the callback correctly:
```js
    </div>
    );
  })}
```
(one `);` to close the `return`, one `}` to close the arrow function body, matching the existing `)}` that closes `.map(` and the outer JSX container.)

**Verification approach — actually run it through Babel, not just eyeball it:**
```bash
node -e "
  const fs = require('fs');
  const content = fs.readFileSync('event-tools.html', 'utf8');
  const match = content.match(/<script type=\"text\/babel\"[^>]*>([\s\S]*?)<\/script>/);
  fs.writeFileSync('scratch_script.js', match[1]);
"
# then, in a scratch dir with @babel/core + @babel/preset-react installed:
node -e "
  const babel = require('@babel/core');
  const code = require('fs').readFileSync('scratch_script.js', 'utf8');
  const result = babel.transformSync(code, {
    presets: [['@babel/preset-react', { runtime: 'classic' }]],
    filename: 'script.jsx',
  });
  console.log('OK', result.code.length);
"
```
This caught the exact `Missing semicolon` error at the broken `))}` before the fix, and confirmed a clean transform after. `CLAUDE.md` already carries a caveat that local `@babel/core` can't catch **CDN version drift** — but that caveat is about a different failure mode (an unpinned/different Babel version silently changing behavior). It says nothing about catching plain syntax errors, which local Babel is perfectly capable of doing and which `/predeliver` currently never attempts.

### 5. Version and changelog

- `APP_VERSION` bumped `v2.14.1` → `v2.14.2`
- In-file changelog header rewritten (not "additive" — per convention it always shows only the current version) to describe the blank-page bug and its fix
- `ggpogo-event-tools-CHANGELOG.md` v2.14.2 entry added, including the same process-gap note as here

### 6. Recommendation (not yet actioned — flagged for Eric)

Add a **10th check to `/predeliver`**, or a mandatory manual step called out in its instructions: actually attempt a local Babel transform of the extracted `<script type="text/babel">` contents (React preset, classic runtime) and hard-fail if it throws. This wouldn't replace the existing 9 checks (which catch WordPress-sanitizer-specific corruption that only manifests in the *live, pasted* HTML — a local parse can't detect that) — it would catch the *other* class of failure: a plain structural JS/JSX mistake that breaks parsing regardless of where the file is pasted. Recommend requiring this specifically whenever a delivery touches control flow, function signatures, or JSX structure (not needed for pure string/text-only edits). Not implemented yet this session — needs Eric's go-ahead since it changes the skill again and adds a Node/Babel dependency to the delivery process.

### 7. File manifest (this session)

- `event-tools.html` — `APP_VERSION` v2.14.1 → v2.14.2; fixed the My Activity map() closing-bracket mismatch; rewrote in-file changelog header
- `ggpogo-event-tools-CHANGELOG.md` — v2.14.2 entry appended
- `ggpogo-event-tools-engineering-breakdown.md` — this section (new)

**Status at end of session:** fix verified via Babel transform, ready to re-deliver. Eric needs to re-paste the corrected `event-tools.html` into the WordPress Custom HTML block (page ID 149) and confirm `APP_VERSION` shows `v2.14.2` on the live page after cache purge.

---

## Session: 2026-07-19 (same day) — performance investigation, prompted by a suspected slow-loading background image

**Scope:** Eric suspected the Event Tools page's background image was slowing load times on lower-spec devices/connections and asked what else could be done. Investigated with real measurements rather than assumptions, found the actual biggest offender was something else entirely, and shipped v2.14.3 (Event Tools) + v1.5.2 (site-styles).

---

### 1. Measuring instead of guessing

Rather than accept "the background image" as the only culprit, every asset the page actually loads was measured directly (`curl -s -o /dev/null -w "%{size_download}"` against each real URL):

| Asset | Size |
|---|---|
| `@babel/standalone@7.29.7` (babel.min.js) | **3.07 MB** |
| `bg-wave.png` (site-wide header texture) | 1.86 MB |
| `firebase-database-compat.js` | 162 KB |
| `firebase-auth-compat.js` | 136 KB |
| `react-dom@18` production.min.js | 129 KB |
| `firebase-app-compat.js` | 31 KB |
| `react@18` production.min.js | 10.5 KB |

**Babel Standalone, not the background image, is the single heaviest thing on the page** — 60% larger than `bg-wave.png`, and unlike a static image it also costs real CPU time: the browser has to parse and transpile the app's ~420KB of JSX in-thread before anything can render, which lands hardest on exactly the lower-spec devices Eric was worried about.

Also tested (and rejected) migrating Firebase to its modular SDK as a possible quick win: fetched the modular build URLs directly (`firebase-app.js`, `firebase-database.js`, `firebase-auth.js` at the same CDN path) and found them **the same size or larger** than the compat builds already in use (e.g. modular `firebase-app.js` is 102KB vs. compat's 31KB) — tree-shaking only happens with an actual bundler, and loading modular builds via plain `<script>` tags gets none of that benefit. Not worth the migration churn.

### 2. Decisions, via `AskUserQuestion`

Presented three decisions rather than picking for Eric:
1. **bg-wave scope:** recompress site-wide vs. remove only from Event Tools vs. both → **chose both**.
2. **Low-risk quick wins** (defer + preconnect) → **yes, do now**.
3. **Pre-compile JSX to drop Babel Standalone entirely** (the biggest lever, but a real architecture change — conflicts with `CLAUDE.md`'s deliberate "no build pipeline" stance) → **not now**, flagged for a future session.

### 3. bg-wave.png recompression

Downloaded the live image directly, inspected it with `sharp` (Node): 1024×1536 PNG, no alpha, and — critically — a flat-color wavy-gradient graphic, not a photo. That's exactly the kind of image lossy WebP compresses extremely well. Generated several quality levels:

| Format | Size | Reduction |
|---|---|---|
| Original PNG | 1.86 MB | — |
| Optimized PNG (palette, sharp) | 199 KB | 89.5% |
| WebP q50 | 7.2 KB | 99.6% |
| WebP q65 | 8.3 KB | 99.6% |
| **WebP q75 (chosen)** | **9.3 KB** | **99.5%** |
| WebP q80 | 11.4 KB | 99.4% |

Rendered downscaled previews of the original vs. the q75 WebP side by side and visually confirmed no perceptible difference — expected, since the image is only ever shown at 14% opacity with `mix-blend-mode: overlay`.

**Delivered, not yet live:** I can't upload to the WordPress Media Library directly, so both the WebP (`delivery-assets/bg-wave.webp`, recommended) and the palette PNG (`delivery-assets/bg-wave-optimized.png`, alternative if Eric prefers to keep the exact same file path/URL by overwriting the file in place rather than uploading a new one) were placed in the project working directory (untracked — these are one-off delivery assets for a different system, not repo source of truth, so not committed to git). Eric needs to upload one and either update the CSS `url()` (if the path changes) or simply overwrite the existing file at the same path (if keeping `bg-wave.png`/same URL — no CSS change needed in that case).

**Separately, CSS change (shipped this session):** added `.page-id-149 .gg-page-header::before { background-image: none !important; }` to `ggpogo-site-styles.css` so Event Tools drops the texture layer entirely, independent of whatever happens with the site-wide image swap. Bumped to v1.5.2, in-file header + companion CHANGELOG updated.

### 4. `defer` + preconnect — tested before shipping, not assumed

Given this session already had one blank-page incident from an unverified assumption (the v2.14.1→v2.14.2 bracket-matching bug), `defer` wasn't just added and hoped for the best. The app's whole architecture depends on script execution order: React, ReactDOM, and all three Firebase globals must exist before the `<script type="text/babel">` app code runs.

Built a minimal reproduction of the real script tag order (all 6 CDN scripts with `defer` added) plus a stub `text/babel` block that checks `typeof React/ReactDOM/firebase` and renders the result, then ran it in a real headless Chromium via Puppeteer (installed fresh into the scratchpad directory, not the project). Result: `ALL-GLOBALS-OK` — confirmed `defer` preserves the needed execution order (deferred scripts execute in document order, after parsing, before `DOMContentLoaded`; Babel Standalone's own DOM scan for `text/babel` tags happens on/after that same point).

Shipped: `defer` on all 6 CDN `<script>` tags, plus `<link rel="preconnect">` for `fonts.googleapis.com`/`fonts.gstatic.com`. Bumped Event Tools to v2.14.3. Re-ran the full `/predeliver` checklist (all 9 checks clean) and, per the lesson from the v2.14.2 incident, re-verified the script block still parses cleanly via a local Babel transform even though this change didn't touch JSX/control flow directly.

### 5. What's still open

- **Eric needs to upload the compressed bg-wave asset** and either repoint the CSS `url()` or overwrite the file in place — the biggest remaining win (1.86MB → ~9KB, site-wide) isn't live until that manual step happens.
- **Babel Standalone pre-compilation** (the single largest lever, ~3MB + transpile CPU cost) was explicitly deferred, not rejected — worth a dedicated session if Eric wants to pursue it, since it changes the delivery workflow (I'd compile JSX to plain JS before every future handoff) and needs a scoped proposal first per `CLAUDE.md`'s "scope before code" convention.

### 6. File manifest (this session)

- `event-tools.html` — `APP_VERSION` v2.14.2 → v2.14.3; `defer` on 6 CDN scripts; font preconnect hints; in-file changelog header rewritten
- `ggpogo-event-tools-CHANGELOG.md` — v2.14.3 entry appended
- `ggpogo-site-styles.css` — `Version: 1.5.1` → `1.5.2`; `.page-id-149` bg-wave override added; in-file header rewritten
- `ggpogo-site-styles-CHANGELOG.md` — 1.5.2 entry appended
- `delivery-assets/bg-wave.webp`, `delivery-assets/bg-wave-optimized.png` — untracked, for Eric to upload
- `ggpogo-event-tools-engineering-breakdown.md` — this section (new)

---

## Session: 2026-07-19 (same day) — clearing up confusion between three separate "background" things, and finding a second image

**Scope:** Eric deployed v2.14.3 (`event-tools.html`) but not v1.5.2 (`ggpogo-site-styles.css`), saw no visible change, and — separately — noticed the app itself has a different, much more visible background image than `bg-wave.png`. This session tracked down that second image, then investigated Eric's report that he'd "never seen bg-wave anywhere" to confirm whether anything was actually broken. No code shipped this session; investigation only.

---

### 1. A second background image: `settings:branding.bgImage`

Eric inspected the live app in DevTools and found:
```css
background: url(http://ggpogo.com/wp-content/uploads/2026/05/superRes-scaled.png) center center / cover no-repeat;
```
This is a completely different mechanism from `bg-wave.png` — not a static CSS asset at all. `event-tools.html` has a host-only "Branding" settings screen (`BrandingSettings`, ~line 4066) where a host can paste a custom background-image URL, saved to Firebase RTDB at `settings:branding.bgImage`. `useBrand()` (~line 922) watches that path and merges it over `DEFAULT_BRAND` (where `bgImage` defaults to `""`, ~line 915). The `App()` root component (~line 7466) then applies it as the page background across **every screen of the app**:
```js
background: c.bgImage ? (!bgFailed ? `url(${c.bgImage}) center/cover no-repeat` : c.grassMid) : c.grassMid,
```
Fetched the URL directly to confirm it's real and to quantify it: **1.07MB PNG**, loaded on every screen. Since this value lives in the database, not in any file in this repo, there was no way to have found it by reading the codebase alone — it had to be reported from the live DOM first, then matched back to the code path that produces it. Confirmed for Eric that the DevTools-reported `center center / cover no-repeat` and the code's `center/cover no-repeat` are the same rule (browsers expand shorthand to longhand in the inspector).

**Not yet resolved** — two options on the table, Eric hasn't chosen yet:
1. Clear the live value via the app's own Branding screen (instant, no deployment, fully reversible) — the only option I can't do myself, since it requires being signed in as a host in the live app.
2. Additionally strip the `bgImage`/`logoImage` customization capability out of the code entirely, so it can't be set again — a real product decision, not just a performance fix.

### 2. "I never saw bg-wave anywhere" — checked live, nothing is actually broken

Rather than take "no visible difference" as ambiguous, pulled the actual live page and CSS to check three possibilities: (a) the v1.5.2 fix wasn't deployed, (b) the original effect was always imperceptible, or (c) something is genuinely broken.

**Fetched the live `/event-tools/` page HTML and extracted the actual deployed `<style id="wp-custom-css">` block** (WordPress inlines Customizer "Additional CSS" into the page under that id — found by listing all inline `<style>` ids on the page, not guessed): it still carries `Version: 1.5.1` in its header comment, and its `.gg-page-header::before` rule still points at `bg-wave.png` with no `.page-id-149` override present anywhere in it. **Confirmed: only `event-tools.html` was redeployed; `ggpogo-site-styles.css` v1.5.2 was never pasted into WordPress.** That fully explains "no visible difference" for the CSS side on its own.

**But also checked whether the original effect was ever visible in the first place**, independent of the above, using a headless-browser inspection (Puppeteer) of the actual live page:
- `bg-wave.png` request returns **200**, no failed requests, no CORS/load errors.
- The `::before` pseudo-element's computed styles are exactly as coded: correct box (1160×200px, matching the header), `position: absolute`, `background-image` correctly resolved to the real URL, `opacity: 0.14`, `mix-blend-mode: overlay`, `z-index: 0`.
- Screenshotted the live header element directly: a **completely smooth, flat gradient — no visible wave texture at all.**

**Conclusion given to Eric:** nothing is broken. The rule renders exactly as written; it's just that 14% opacity blended with `overlay` mode, on an image whose colors are close in hue to the gradient it's laid over, produces an effect that's mathematically almost zero at typical viewing conditions — not a bug, just a design that landed at "invisible" rather than "subtle." This also means removing it (once actually deployed) will show **zero visual difference**, which is the *expected*, correct outcome — the win was always going to be network-only (1.86MB off every page load), never visual.

### 3. Where things stand

- **`bg-wave.png` (WordPress site-wide texture):** code fix committed (`624670c`, v1.5.2) but **not deployed** — Eric still needs to paste the updated `ggpogo-site-styles.css` into Additional CSS. The compressed replacement image (`delivery-assets/bg-wave.webp`) is also still pending upload/URL swap.
- **`settings:branding.bgImage` (in-app custom background, `superRes-scaled.png`):** identified and quantified (1.07MB), **not yet touched** — awaiting Eric's choice between clearing the live value vs. also removing the code capability.
- **`event-tools.html` v2.14.3 (defer/preconnect):** deployed successfully; the lack of visible change here was expected and correct (performance-only change, no rendering difference by design).

### 4. File manifest (this session)

- No files changed — investigation and clarification only.
- `ggpogo-event-tools-engineering-breakdown.md` — this section (new)
