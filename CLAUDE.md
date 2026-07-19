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
3. For Event Tools work: consult `ggpogo-engineering-reference.md`
4. For website work: consult `ggpogo-website-handoff.md`
5. For historical detail on any file: check its `*-CHANGELOG.md`

---

## Repository layout

**Canonical files at root** — one non-versioned name per artifact. Always edit these.

| File | Purpose |
|---|---|
| `event-tools.html` | Current Event Tools app |
| `ggpogo-site-styles.css` | Site-wide stylesheet |
| `events-sections.html` | Events page Custom HTML block |
| `ggpogo-map-page.html` | Map page Custom HTML block |
| `firebase-database-rules.json` | Firebase RTDB rules |
| `ggpogo-engineering-reference.md` | Event Tools authoritative reference |
| `ggpogo-website-handoff.md` | Website state + open items |
| `ggpogo-event-tools-CHANGELOG.md` | Full Event Tools history |
| `ggpogo-site-styles-CHANGELOG.md` | Full stylesheet history |
| `commit.bat` | Version tagging + push automation |

**`archive/` subdirectories** — every prior versioned build. Read-only in practice; never edit archived files, never resurrect one at root.

```
archive/
├── engineering-reference/
├── events-sections/
├── firebase-rules/
├── homepage-b/           (deprecated experiments)
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

Always complete files, never patches or diffs. One source of truth per artifact. In-file changelog headers include ONLY the latest version's changes — full history lives in the companion `*-CHANGELOG.md`.

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

## WordPress deploy sequences

### CSS
1. Copy full `ggpogo-site-styles.css`
2. WP → Appearance → Customize → Additional CSS → paste (replace all)
3. Publish
4. SiteGround → "Purge SG Cache"
5. Cloudflare → Custom Purge for ggpogo.com
6. Hard reload in incognito

### Event Tools
1. Copy full `event-tools.html`
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

Full path detail, per-item shapes, and the write-constraint expressions live in `ggpogo-engineering-reference.md` and `firebase-database-rules.json`.

---

## External integrations

- **Google Calendar ID:** `0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc@group.calendar.google.com`
- **Calendar API key:** `AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc` (Calendar API only). In JS files it must be encoded — the `@` in the Calendar ID is `\u0040` (see pre-delivery checklist item 2).
- **Campfire deep link:** `https://campfire.onelink.me/eBr8?af_dp=campfire://&af_force_deeplink=true&deep_link_sub1=cj1jbHVicyZjPTM3NzgzYzEyLWYzNWYtNDg4Yy04ZmQxLTM2ZWEyYjJlNGE0ZCZpPXRydWU=`
- **Cloudflare Worker (Campfire CORS proxy):** `https://cmpf-tools.de/api` — also runs a scheduled 7 PM Pacific cron for daily Campfire data fetch. Source in `campfire-cors-proxy-worker.js`.

---

## Design tokens (fast reference)

Full detail in `ggpogo-website-handoff.md`.

- **Fonts:** Fredoka (headings), Nunito (body)
- **Blue** `#1FA5DC` / **Blue Deep** `#0E5C9E` — primary, brand pages
- **Green** `#7DC25C` / **Green Deep** `#3F8A36` — community, action
- **Orange** `#F08838` / **Orange Deep** `#C45A1F` — Campfire, reference
- **Gold** `#F5C842` — **tip boxes ONLY, never repurpose**
- **Paper** `#FFFCF2` — page background
- **Paper Edge** `#E8DEC0` — card borders
- **Ink** `#0D2D52` — headings

## Page IDs (WordPress)

Home=8, About=19, Events=21, Resources=23, Contact=25, Event Tools=149, Privacy Policy=241.

Map page — needs its ID once published, added to `.page-id-NNN .entry-title { display: none; }` list in section 24 of the stylesheet.

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

- `ggpogo-engineering-reference.md` — Event Tools architecture, Firebase paths, auth model, product backlog, versioning convention
- `ggpogo-website-handoff.md` — Site status per page, design system detail, WordPress admin notes, pending items
- `ggpogo-event-tools-CHANGELOG.md` — Full Event Tools history
- `ggpogo-site-styles-CHANGELOG.md` — Full stylesheet history

If they disagree with this file, they win. This file is a fast index; they are the source of truth.
