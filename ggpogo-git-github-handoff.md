# GGPoGo Git & GitHub Setup — Handoff

**Date:** 2026-07-06
**Status:** Set up and in active use for the Event Tools app. Pokemon icon repo created, empty (no images yet).

---

## TL;DR for the next session

Eric now has real version control for the Event Tools app, set up for the
first time this session. Two GitHub repos exist:

- **`ggpogo/ggpogo-event-tools`** (private) — the app's source history.
  The single evolving working file is `event-tools.html`; every delivery
  overwrites it and gets committed + tagged with its version number.
- **`ggpogo/ggpogo-pokemon-icons`** (public) — badge art library for the
  Passport feature. Empty right now; naming convention documented in its
  own README (lowercase, spaces→hyphens, periods/apostrophes dropped,
  gender symbols→`-f`/`-m`).

Eric is new to git/GitHub — this is his first repo. Everything below
assumes zero prior git knowledge on his end. If you're an AI session
picking this up: **give exact copy-pasteable Windows Command Prompt
commands, one step at a time, and ask him to paste the output back before
moving on.** He's been reliable at running commands and pasting output
verbatim, but doesn't know what any of it means yet, and second-guessing
"did that actually work" via literal grep/count checks (not just "looks
right") has already caught real bugs before delivery.

---

## Why this exists

Before this, every delivered `.html` version was just a new file
(`wordpress-block-v2_12_23.html`, `wordpress-block-v2_12_24.html`, ...) with
no way to see a real line-by-line diff between them short of manually
opening two 5,700+ line files side by side. Git gives:

- Real diffs between any two versions of `event-tools.html`
- A way to bisect "which delivery introduced this bug"
- A revert path if a delivery turns out broken
- An off-machine backup (GitHub), not just local files

## What's actually set up

### Local folders (on Eric's Windows machine)

```
C:\Users\niani\Documents\ggpogo-event-tools\      (app code repo)
C:\Users\niani\Documents\ggpogo-pokemon-icons\    (icon library repo)
```

Both are real git repos (`git init` + `git remote add origin ...`, or
`git clone` for the icons repo since GitHub created it with a README
first). Both are connected to GitHub under the `ggpogo` org/account.

### `ggpogo-event-tools` repo contents

- `event-tools.html` — **the tracked working file.** Same filename every
  delivery, overwritten each time. This is what gives real `git diff`
  history — a file that changes content under a stable name, not a new
  file per version.
- The original 90+ dated snapshot files (`wordpress-block-v2_*.html`) were
  imported as-is in the very first commit, as a historical archive.
  Continuing to also save a dated snapshot per delivery is optional now,
  not required — `event-tools.html` + a version tag is the real record.
- `.gitignore` — excludes the Firebase admin service-account JSON key
  (`*firebase-adminsdk*.json`), bulk zips/PDFs, and old scratch files.
  **Important:** a Firebase admin key briefly existed in this folder
  before this setup and was deleted by Eric before the first commit — it
  was never actually committed to git, but if that key is still live in
  Firebase, rotating it is a separate, still-open action item (not a git
  problem, a Firebase Console one).
- Other project docs (changelogs, engineering references, CSS versions,
  handoff docs) were imported into this same repo in the first commit.

### `ggpogo-pokemon-icons` repo contents

- `README.md` — naming convention only, no images yet.
- Referenced from the app code via
  `https://raw.githubusercontent.com/ggpogo/ggpogo-pokemon-icons/main/{name}.png`
  (see `pokemonIconUrl()` in `event-tools.html`).
- Chosen over Google Drive/OneDrive because neither produces a stable,
  reliably hotlink-able direct image URL without workarounds that are
  known to break (expiring links, viewer-page URLs instead of raw bytes).
  GitHub raw URLs are simple and don't expire.

---

## Commit message format

**Pattern:** `vX.X.X: short description`

Examples actually used this session:
```
v2.13.0: Add Passport: self check-in, milestone and named event badges, Passport Settings
v2.13.1: Fix select dropdown cutoff, add Campfire event picker with type/icon auto-suggest to Passport
v2.13.2: Fix Passport default event selection, dropdown text clipping, badge icon cropping
```

Rules:
- Version number always matches `APP_VERSION` in the delivered
  `event-tools.html` for that commit — verified by grep before every
  delivery, same as the pre-existing versioning discipline.
- One line, present-tense-ish, matches the tone of delivery notes / the
  changelog — not a git-style imperative mood requirement, just terse and
  factual.
- If a delivery is a bugfix for a previous delivery (not a new feature),
  say so plainly (`Fix ...`) rather than folding it into vague wording.

**Tags:** every commit that ships a version also gets a matching git tag
(`git tag vX.X.X`, pushed separately with `git push origin vX.X.X`). This
is what lets you jump straight to "show me exactly what v2.13.0 looked
like" later, independent of commit message wording.

## The actual workflow (automated)

A script, `commit.bat`, lives at the root of `ggpogo-event-tools` and does
the full sequence in one command:

```
commit.bat v2.13.3 "Fix select dropdown height/padding math causing text clipping"
```

This runs, in order: `git add .` → `git commit -m "vX.X.X: description"` →
`git tag vX.X.X` → `git push` → `git push origin vX.X.X`. It force-`cd`s
into the right folder first regardless of where Command Prompt is
currently pointed, and stops (doesn't push) if the commit step fails —
e.g. nothing changed, or that version tag already exists.

**If a new AI session is handing Eric a delivery:** give him the exact
`commit.bat vX.X.X "..."` line to paste, matching the version you just
delivered. He doesn't need to know what it does internally — just that
it's one line, run after saving the new file into the folder.

## Known gaps / things to know before touching this further

- **No branches.** Everything is on `main`. Fine for a single-person,
  single-AI-session-at-a-time workflow; would need rethinking if Eric or
  Daniel ever wanted to try something experimental without risking the
  live line.
- **No CI/build step**, intentionally — this repo mirrors the actual
  paste-into-WordPress deployment model. Git is a parallel record, not a
  new deployment mechanism. Don't suggest a build pipeline unless the
  underlying app architecture itself changes.
- **The dated snapshot files and `event-tools.html` are not automatically
  kept in sync.** If a future session or Eric edits one without the
  other, they'll drift. Since `event-tools.html` is defined as the real
  source of truth going forward, if you notice a mismatch, that's the
  one to trust.
- **`ggpogo-pokemon-icons` has zero images.** Every Passport badge in the
  live app currently falls back to the GGPoGo logo. This is expected, not
  a bug, until Eric populates the repo.
