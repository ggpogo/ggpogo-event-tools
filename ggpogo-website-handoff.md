# GGPoGo Website Redesign Handoff — v1.4.3

**Date:** 2026-06-30
**Status:** Cross-site unification largely complete (Home, Events, Resources, Event Tools migrated). About + Contact pages still on old design. Header polish iteration in progress.

---

## TL;DR for the next session

I've been working with Eric (organizer of GGPoGo, Garden Grove's Pokémon GO community) on a multi-page WordPress redesign of ggpogo.com. The big v1.4.x effort unified visual vocabulary across pages (gradient hero band, folder-tab nav, canonical section labels, CTA bands, icon-in-circle cards). The most recent stylesheet delivered is **v1.4.3**. Eric prefers **complete file replacements** over patches. Always purge SiteGround → Cloudflare → reload incognito after CSS changes.

First task for next session: have Eric confirm v1.4.3 deployed correctly (screenshot the live header from Resources or Home), then continue migrating About and Contact pages to the canonical patterns.

---

## What's been done in v1.4.x

### Design system established

A single, consistent visual vocabulary across all redesigned pages:

- **`gg-page-header`** with `--tall` (Home) and `--short` (every other page) variants. Shared green→blue 135deg gradient, shared border-radius, contained to 1200px.
- **`gg-section-label`** — uppercase small-caps section labels site-wide. Aliases `gg-res-label`, `gg-recur-heading`, `gg-cal-heading` resolve to same look.
- **`gg-cta-band`** with `--green` (join actions) and `--blue` (explore actions) variants. Alias `gg-events-cta` → green variant.
- **`gg-card-icon`** — canonical icon-in-tinted-circle pattern. Modifiers: `--blue`, `--green`, `--orange`, `--gold`, `--discord`, `--instagram`, `--campfire`. Supports inline SVG or emoji content.
- **Folder-tab navigation** — manila tabs, paper-cream fill, colored top stripes per page (blue = brand/identity, green = action, orange = reference/connection). Active tab grows taller via padding (not floating).
- **Hero stats** restyled to white-on-translucent (was gold) — gold restored to documented tip-box-only role.
- **Site-wide max-width 1200px** with cream margins. Overrides Astra's `--ast-container-max-width` variable.
- **Event Tools page added to main nav** as community-friendly tool.

### Pages migrated

- **Home (page-id 8):** `gg-hero-b` → `gg-page-header gg-page-header--tall`; stats are translucent inside hero.
- **Events (page-id 21):** kept its Custom HTML block (events-sections-v2.4.html); local classes (`gg-recur-heading`, `gg-cal-heading`, `gg-events-cta`) mapped to canonical look via CSS aliases — no HTML changes required.
- **Resources (page-id 23):** `gg-hero-resources` → `gg-page-header gg-page-header--short`; community cards now use inline SVG line icons (Discord brand mark, Lucide camera, flame) instead of emoji.
- **Event Tools (page-id 149):** new Cover block above the app, classed `gg-page-header gg-page-header--short`; page title hidden via `.page-id-149 .entry-title`.

### WordPress menu setup (already done by Eric)

- Event Tools added to main menu
- Per-item CSS classes set in **Appearance → Menus**:
  - Home → `nav-home`
  - Events → `nav-events`
  - Resources → `nav-resources`
  - About → `nav-about`
  - Event Tools → `nav-eventtools`
  - Contact → `nav-contact`

---

## v1.4.3 changes (what I just shipped)

These addressed the open issues from v1.4.2's field test:

1. **Header was too tall, creating a "white block extending over the green hero".** v1.4.3 forces `padding: 0`, `min-height: 0`, `height: auto` on `.site-header` plus every Astra wrapper (`.ast-above-header-wrap`, `.ast-below-header-wrap`, `.ast-secondary-header-wrap`, `.main-header-bar-wrap`, `.ast-primary-header-bar`). Inner padding-top dropped to 6px.

2. **bgwave height reduced.** Was 80px tall band at 0.22 opacity in v1.4.2; now 40px at 0.18 — tighter visual baseline directly under the tabs rather than a thick atmospheric band.

3. **Resources list rows were too tall and had varying border widths.** v1.4.3 forces `width: 100% !important`, `box-sizing: border-box !important`, and `display: flex` on `.gg-res-row` AND its `.wp-block-group__inner-container`. All internal block-editor padding/margin aggressively reset.

4. **Confidence level on these fixes:** medium-high for the rows, medium for the header. The header issue is hard to debug remotely because Astra has many wrapping divs that can carry padding/min-height defaults. If the white block persists after v1.4.3, next move is to have Eric send a DOM inspector screenshot of the `.site-header` element with computed styles, so we can see exactly what's contributing to the height.

---

## Pending — for next session

### High priority

1. **Verify v1.4.3 deployed correctly.** Have Eric apply, purge caches, screenshot the live Home + Resources pages. Confirm: header is tight (tabs sit right above the cream body baseline, no big white gap before green hero), Resources rows are full-width with consistent border widths, no awkward vertical spacing between rows.
2. **About page migration.** Apply `gg-page-header gg-page-header--short`, `gg-section-label` for sections, update `gg-ambassador-card` and `gg-what-we-do` cards to match canonical grammar, add closing `gg-cta-band--green`.
3. **Contact page migration.** Apply `gg-page-header gg-page-header--short`, ensure form styling fits the paper aesthetic, closing CTA.

### Medium priority

4. **Resources page** — add a "Maps & Trackers" section (deferred content task; Eric will provide curated links).
5. **Delete legacy hero aliases** (section 27 of the CSS) once Eric confirms all pages migrated and live.
6. **Update Events page Custom HTML** to use canonical class names (`gg-section-label`, `gg-cta-band--green`) directly instead of local `gg-recur-heading`/`gg-cal-heading`/`gg-events-cta`. Would become events-sections-v2.5.html. Not urgent since aliases work — but cleaner long-term.

### Low priority / known caveats

7. **Mobile hamburger menu styling.** Currently uses Astra default — folder tabs are desktop-only by design. Could polish the hamburger menu to match if Eric wants, but it works as-is.
8. **bgwave visibility tuning.** v1.4.3 sets opacity 0.18 on a 40px band. If it's still hard to see, bump to 0.25 or increase height. If too prominent, drop to 0.12.
9. **About + Contact migrations need screenshot evidence first** — I haven't seen the current state of those pages in this session, only Home/Events/Resources/Event Tools.

---

## Key facts to carry forward

### Stack
- WordPress + Astra theme + Gutenberg block editor
- Hosting: SiteGround + Cloudflare
- Cache purge sequence (always required after CSS change): SiteGround "Purge SG Cache" → Cloudflare custom purge for ggpogo.com → hard-reload incognito

### Page IDs
- Home = 8
- About = 19
- Events = 21
- Resources = 23
- Contact = 25
- Event Tools = 149
- Privacy Policy = 241 (footer-only, not in nav)

### Design tokens
- Fonts: Fredoka (headings) · Nunito (body) · weights 400/500/600/700
- Colors and roles:
  - Blue `#1FA5DC` / Blue Deep `#0E5C9E` — primary interactive, links, brand/identity pages
  - Green `#7DC25C` / Green Deep `#3F8A36` — community accent, action pages
  - Orange `#F08838` / Orange Deep `#C45A1F` — Campfire, reference pages, highlights
  - Sun Gold `#F5C842` — **tips and gold highlights ONLY** (do not repurpose)
  - Paper `#FFFCF2` — page backgrounds and card surfaces
  - Paper Dim `#F5EFDC` — inactive tab fill
  - Paper Edge `#E8DEC0` — card borders
  - Ink `#0D2D52` — headings, dark text
  - Ink Soft `#3D5B82` — body text
  - Ink Mute `#7A8FA8` — labels, muted captions
- Radii: 16px (cards) · 10px (small) · 50px (pills)
- Site-wide max-width: 1200px

### Asset URLs
- Logo mark: `https://ggpogo.com/wp-content/uploads/2026/05/cropped-logo-no-text.png`
- Logo wordmark: `https://ggpogo.com/wp-content/uploads/2026/05/logo-full.png`
- bgwave (header texture): `https://ggpogo.com/wp-content/uploads/2026/04/bg-wave.png` (2026/04 folder, hyphenated filename — easy to get wrong)

### Eric's workflow preferences
- **Always deliver complete file replacements**, not patches or fragments. Single source of truth per file.
- Confirm scope and design decisions before writing code.
- Visual issues verified via screenshots; field-tested on mobile after each delivery.
- No em dashes or en dashes in site copy (technical docs OK).
- Pre-delivery verification on Event Tools app: grep for `&&` (excl. comments), `confirm(` calls, version bumps.
- Desktop for editing, mobile for testing.
- Cache purge always = SiteGround → Cloudflare → hard-reload incognito.

### WordPress/Gutenberg gotchas
- WordPress sanitizer corrupts JS inside Custom HTML blocks:
  - Raw `@` → SyntaxError (fix: `\u0040`)
  - `&&` → `&#038;&#038;` (fix: nested if statements, no shorthand)
  - `&` in query strings → entity-encoded (fix: use `URL` API with `searchParams.set()`)
- Babel Standalone must be pinned to `@7.29.7` with `data-presets="react"` and `/** @jsxRuntime classic */` as first line
- Astra Footer Builder strips raw SVGs — use CSS pill-button text links
- Astra header has many wrapping divs that each can add padding; constrain aggressively when fixing header height
- Astra's `--ast-container-max-width` CSS variable controls all .ast-container widths — redefine to 1200px to win

---

## State outside the website

### Event Tools app (separate workstream)
- Current version: **v2.12.22**
- Any future delivery must bump to v2.12.23+ (never reuse a version number)
- Firebase project: `ggpogo-tools-us` (us-central1), RTDB at `https://ggpogo-tools-us-default-rtdb.firebaseio.com`
- Cloudflare Worker proxies `https://cmpf-tools.de/api`; cron at 7 PM Pacific delivers daily Campfire API fetch to `stats:cache`
- Daniel (co-ambassador, Ironbear1777) still needs `/roles/hosts/{uid}: true` set in Firebase — requires him to sign in once first to generate a UID

### Community rules (carry into any content work)
- No endorsement of dataminers, unofficial map trackers, or paid third-party raid services
- Raid Hour events listed at 5:45 PM intentionally — Eric arrives early to greet newcomers; official communicated time is 6:00 PM. Never suggest changing the calendar time.

---

## Files in the project

Most recent and relevant:
- **`ggpogo-site-styles-v1_4_3.css`** ← current production stylesheet (paste into Appearance → Customize → Additional CSS)
- `ggpogo-website-handoff-2026-06-30.md` ← this document
- `ggpogo-v1_4_1-resources-icons.md` — inline SVG snippets for Resources community cards (already applied)
- `events-sections-v2_4.html` — Events page Custom HTML block (currently in production)
- `ggpogo-v1_4_0-migration-checklist.md` — page-by-page migration steps (mostly complete; About and Contact remaining)

Superseded but kept for history:
- `ggpogo-site-styles-v1_4_0.css`
- `ggpogo-site-styles-v1_4_1-patch.css`
- `ggpogo-site-styles-v1_4_2.css`

The current source of truth is **v1.4.3**.

---

## How to start the next session

Paste this entire document as the first message in a new chat with Claude. Then attach a screenshot of the live ggpogo.com home or resources page (after v1.4.3 has been applied and caches purged) so the new session can see the current state.

If v1.4.3 worked, jump to About + Contact migrations.

If v1.4.3 still has issues (header height or row spacing), the next debug step is a DOM inspector screenshot of the problem element with its computed styles panel open — that's the fastest way to identify the specific Astra rule that's winning the cascade.
