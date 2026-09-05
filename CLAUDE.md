# CLAUDE.md — GGPoGo project working guide

Read by Claude Code (and any AI assistant working in this repo) as persistent project context. Kept tight and operational — deep detail lives in the reference docs linked at the bottom. If those disagree with this file, they win.

---

## Community context

**GGPoGo** — the Garden Grove Pokémon GO community, founded January 21, 2024. 6,600+ members. Eric (founder, primary organizer) is a Niantic Community Ambassador; Daniel (Ironbear1777) is co-ambassador. Contact: gardengrovepogo@gmail.com.

**Content rules for anything user-facing:** don't endorse dataminers, unofficial map trackers, or paid third-party raid services. Only link official Niantic sources and well-established community tools.

---

## What this repo is

Mixed workspace for two interconnected projects:

1. **Event Tools** — single-file React 18 UMD + Babel Standalone + Firebase compat SDK web app. Deployed as a WordPress Custom HTML block on ggpogo.com/event-tools/. No build pipeline.
2. **GGPoGo.com website** — WordPress + Astra + Gutenberg. Canonical stylesheet pasted into Appearance → Customize → Additional CSS. Per-page Custom HTML blocks for Events, Map, etc.

---

## Session start

1. `git status` and `git log --oneline -5` — orient to current state
2. Skim this file
3. For Event Tools work: consult `event-tools/ggpogo-engineering-reference.md`
4. For website work: consult `website/ggpogo-website-handoff.md`
5. For historical detail on any file: check its `*-CHANGELOG.md`

---

## Repository layout

As of 2026-09, root files are organized into per-project folders instead of sitting loose at repo root. Each canonical file is still a single non-versioned name — always edit these directly.

| File | Purpose |
|---|---|
| `event-tools/event-tools.html` | Current Event Tools app |
| `event-tools/ggpogo-engineering-reference.md` | Event Tools authoritative reference |
| `event-tools/ggpogo-event-tools-CHANGELOG.md` | Full Event Tools history |
| `event-tools/ggpogo-event-tools-engineering-breakdown.md` | Event Tools session-level engineering log |
| `event-tools/firebase-database-rules.json` | Firebase RTDB rules |
| `event-tools/roles-import.json` | One-off Firebase roles import payload |
| `website/events-sections.html` | Events page Custom HTML block |
| `website/ggpogo-map-page.html` | Map page Custom HTML block |
| `website/ggpogo-map-page-engineering-breakdown.md` | Map page engineering breakdown |
| `website/ggpogo-website-handoff.md` | Website state + open items |
| `website/ggpogo-brand-guide.html` | Brand/style reference doc |
| `workers/campfire-cors-proxy-worker.js` | Campfire Tools CORS proxy + scheduled stats refresh (Cloudflare Worker) |
| `workers/ggpogo-calendar-sync-worker.js` | Calendar Sync Cloudflare Worker |
| `commit.bat` | Version tagging + push automation (root — run from repo root) |

**`ggpogo-site-styles.css` and `ggpogo-site-styles-CHANGELOG.md` are no longer in this repo.** The site-wide stylesheet migrated to the separate `ggpogo-website` repo (`deliverables/ggpogo-site-styles.css`, `docs/CHANGELOG.md`) as part of the 3a redesign — see that repo's handoff doc. Don't recreate these files here.

**`archive/` subdirectories** — every prior versioned build. Read-only in practice; never edit archived files, never resurrect one at root.

```
archive/
├── engineering-reference/
├── events-sections/
├── firebase-rules/
├── homepage-b/           (deprecated experiments — includes the abandoned v1 root copy)
├── site-styles/
├── website-handoff/
└── wordpress-block/
```

**Sibling repo:** `ggpogo-pokemon-icons` (public, badge art library used by the Passport system). Naming convention: lowercase, spaces→hyphens, periods/apostrophes dropped, gender symbols→`-f`/`-m`. Served via `raw.githubusercontent.com`.

---

## Working conventions

### Version discipline (Event Tools — non-negotiable)

Every distinct HTML delivery bumps the version in **both** the filename intent AND the `APP_VERSION` constant. Never reuse a version — not even for same-session fixes to an undeployed build. Bump patch (`v2.13.4` → `v2.13.5`). Version is the audit trail; a bad paste is diagnosed by "what version is showing at the bottom of the live page?"

### Delivery format

Always complete files, never patches or diffs. One source of truth per artifact.

**In-file changelog header convention:** every canonical file (`event-tools.html`, `ggpogo-site-styles.css`, etc.) carries a changelog header showing ONLY the latest version's changes, plus a pointer to the companion `*-CHANGELOG.md` for full history. Replace it wholesale on every delivery — never accumulate multiple versions' worth of notes in it.
- **CSS:** a `/* ... */` block comment at the very top of the file (established convention, see `ggpogo-site-styles.css`).
- **Event Tools HTML:** an `<!-- ... -->` HTML comment at the very top of `event-tools.html`, before the root `<div id="ggpogo-event-tools-root">` (established v2.14.1).

### Scope before code

Eric reviews written scope before code is written. UI changes → show visual mockups first. Structural changes → propose shape, wait for confirmation. Substantive work without scope-first triggers a rework.

### CSS specifically

Reuse existing custom properties. Never introduce a new color token without explicit discussion — the palette is locked.

---

## Pre-delivery checklist — Event Tools HTML

**Every delivery. No exceptions.** Backstops against WordPress Custom HTML sanitizer failure modes that have cost real time.

1. **Zero raw `&&` in the script block.** Sanitizer corrupts `&&` → `&#038;&#038;`. Use nested `if` instead. Grep, count zero.
2. **Zero raw `@` in JS strings.** Encode as `\u0040`. Raw `@` throws SyntaxError.
3. **Zero `confirm()` calls.** Use the `useConfirm` hook.
4. **`APP_VERSION` matches filename version** and is bumped from previous delivery.
5. **Babel Standalone pin present.** Currently `@7.29.7`. Unpinned CDN reference is silent breakage.
6. **`data-presets="react"` on the Babel script tag.**
7. **`/** @jsxRuntime classic */` as the first line of the transformed script block.**
8. **URL construction uses `URL` + `searchParams.set()`,** not string concatenation with `&`. Raw `&` in query strings may be entity-encoded.
9. **`signInWithPopup` only,** never `signInWithRedirect` (requires Firebase Hosting which isn't deployed).

Local `@babel/core` verification does not catch CDN version drift — the pin is confirmed by reading the file.

---

## Tooling gotchas

- **Describing `&&`/`@` in comments or docs.** `/predeliver`'s checks 1 and 2 grep the whole file, not just the executed script block — so prose that spells out the literal characters `&&` or `@` (in-file changelog headers, code comments explaining a past fix) will trip the same checks meant to catch real bugs. When writing about these in `event-tools.html`, describe them without the literal token — "double-ampersand", "the raw @ character", "the `@` escape" — rather than typing `&&` or a bare `@` directly into the comment text.
- **`\u0040` vs `\\u0040` when using Edit/Write tool calls.** Getting a literal single-backslash escape sequence (e.g. `\u0040`) into a file via a tool call is unreliable if you reflexively double-escape it, as if targeting a JSON string. Typing `\u0040` as the intended replacement text can silently decode to `@` before it reaches the file; typing `\\u0040` to "be safe" can instead land as two literal backslashes. There's no way to reason about this from the tool-call text alone — after any edit meant to insert a literal escape sequence, verify the actual bytes with `Read` (not `grep`, which can normalize backslashes in terminal output) before moving on. If Edit keeps producing the wrong result, drop to a `PowerShell`/`Bash` script that constructs the backslash explicitly (e.g. `[char]92` in PowerShell) instead of continuing to hand-edit escape sequences via find/replace.

---

## WordPress deploy sequences

### CSS
1. Copy full `ggpogo-site-styles.css` from the `ggpogo-website` repo (`deliverables/ggpogo-site-styles.css` — no longer in this repo)
2. WP → Appearance → Customize → Additional CSS → paste (replace all)
3. Publish
4. SiteGround → "Purge SG Cache"
5. Cloudflare → Custom Purge for ggpogo.com
6. Hard reload in incognito

### Event Tools
1. Copy full `event-tools/event-tools.html`
2. Edit page id 149 → Custom HTML block → paste (replace all)
3. Update
4. Purge caches (same as CSS)
5. Hard reload in incognito
6. **Confirm `APP_VERSION` shows at bottom-left of live page and matches delivery.**

---

## Firebase (Event Tools)

- **Project:** `ggpogo-tools-us` (us-central1). Old project `ggpogo-tools` dormant but retained.
- **RTDB:** `https://ggpogo-tools-us-default-rtdb.firebaseio.com`
- **Auth:** Google sign-in only (`signInWithPopup`). Age gate (13+) on first sign-in. Guest mode with warning banner supported.

### Top-level paths

App-feature namespaces use `name:path` (colon-separated):

- `cd:` — **Code Drop** (`cd:codes`, `cd:session`, `cd:claims`, `cd:sessionLog`, `cd:settings`, `cd:history`)
- `gw:` — **Giveaways** (`gw:session`, `gw:prizes`, `gw:entrants`, `gw:draws`, `gw:history`, `gw:templates`)
- `pp:` — **Passport** (`pp:session`, `pp:checkInLog`, `pp:history`)
- `stats:` — **Meetup Stats** aggregates, host-only (`stats:settings`, `stats:cache`, `stats:snapshots`)
- `settings:` — Public-readable feature settings (`settings:branding`, `settings:passport`)

Identity paths use plain hierarchy (no colon):

- `users/{uid}/` — profile, trainerName, linkedClientIds, activity subtree, passport subtree
- `roles/hosts/{uid}` — boolean host flag (console-managed, no client writes)
- `migrations/{oldId}` — write-once legacy UUID migration fallback

### Rules audit note

Host-only paths (`cd:history`, `gw:history`, `gw:draws`, `stats:*`, `gw:templates`) currently use `auth != null` — any signed-in user could read/write them at the rule layer. Acceptable now because they're only referenced from host-only UI components non-hosts never see. Tightening to check the host role in the rules is on the backlog.

Full path detail, per-item shapes, and the write-constraint expressions live in `event-tools/ggpogo-engineering-reference.md` and `event-tools/firebase-database-rules.json`.

---

## External integrations

- **Google Calendar ID:** `0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc@group.calendar.google.com`
- **Calendar API key:** `AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc` (Calendar API only). In JS files it must be encoded — the `@` in the Calendar ID is `\u0040` (see pre-delivery checklist item 2).
- **Campfire deep link:** `https://campfire.onelink.me/eBr8?af_dp=campfire://&af_force_deeplink=true&deep_link_sub1=cj1jbHVicyZjPTM3NzgzYzEyLWYzNWYtNDg4Yy04ZmQxLTM2ZWEyYjJlNGE0ZCZpPXRydWU=`
- **Cloudflare Worker (Campfire CORS proxy):** `https://cmpf-tools.de/api` — also runs a scheduled 7 PM Pacific cron for daily Campfire data fetch. Source in `workers/campfire-cors-proxy-worker.js`.

---

## Design tokens (fast reference)

Full detail in `website/ggpogo-website-handoff.md`.

- **Fonts:** Fredoka (headings), Nunito (body)
- **Blue** `#1FA5DC` / **Blue Deep** `#0E5C9E` — primary, brand pages
- **Green** `#7DC25C` / **Green Deep** `#3F8A36` — community, action
- **Orange** `#F08838` / **Orange Deep** `#C45A1F` — Campfire, reference
- **Gold** `#F5C842` — **tip boxes ONLY, never repurpose**
- **Paper** `#FFFCF2` — page background
- **Paper Edge** `#E8DEC0` — card borders
- **Ink** `#0D2D52` — headings

## Page IDs (WordPress)

Home=8, About=19, Events=21, Resources=23, Contact=25, Event Tools=149, Privacy Policy=241, Map=319.

---

## What NOT to do

- Never edit files under `archive/`. They're historical.
- Never introduce a new color token to the CSS without discussion.
- Never use gold (`#F5C842`) for stats, accents, or general highlights.
- Never change the Raid Hour calendar start time. 5:45 PM is intentional — Eric arrives early to greet newcomers.
- Never deliver patches or fragments. Complete files only.
- Never skip the pre-delivery checklist to save time. It exists because skipping cost time before.
- Never resurrect a versioned filename at repo root. The canonical name is the only editable copy.
- Never link dataminers, unofficial map trackers, or paid raid services in user-facing content.

---

## Reference docs (authoritative)

- `event-tools/ggpogo-engineering-reference.md` — Event Tools architecture, Firebase paths, auth model, product backlog, versioning convention
- `website/ggpogo-website-handoff.md` — Site status per page, design system detail, WordPress admin notes, pending items
- `event-tools/ggpogo-event-tools-CHANGELOG.md` — Full Event Tools history
- Stylesheet history (`ggpogo-site-styles-CHANGELOG.md`) now lives in the `ggpogo-website` repo, not here

If they disagree with this file, they win. This file is a fast index; they are the source of truth.
