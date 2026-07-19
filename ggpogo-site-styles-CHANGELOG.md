# GGPoGo.com — Site-Wide Stylesheet Changelog

Full historical changelog for `ggpogo-site-styles-*.css`. The in-file
header only lists the latest version's changes going forward — this
file is the source of truth for everything before that.

---

### 1.0.0 — Initial design system

### 1.1.0 — Homepage Concept B (hero, inline stats)

### 1.2.0 — Events page (shorter hero)

### 1.2.x — Footer overhaul + layout fix

### 1.3.0 — Resources page redesign (Concept C)

### 1.4.0 — Cross-site unification
Cross-site unification: `gg-page-header` (tall/short), folder-tab nav, `gg-section-label`, `gg-cta-band` (green/blue), `gg-card-icon`, translucent hero stats, Event Tools in nav, contained max-width.

### 1.4.1 — Header/nav fixes
Fix bgwave URL + opacity, constrain header content, folder tab geometry redesign (no float), legacy Events HTML class mapping, SVG icons in `gg-card-icon`.

### 1.4.2 — Aggressive Astra targeting
Override `--ast-container-max-width`, target `.site-primary-header-wrap` directly, force bottom alignment on header section wrappers.

### 1.4.3 — Header width + Resources rows
Header white background restored to FULL WIDTH (constraint moved to inner `.ast-builder-grid-row` only). bgwave attached as direct `background-image` on `.site-header` so it can't be clipped. Header padding tightened further. Resources rows forced to `width: 100%` to fix staircase separators.

### 1.4.4 — Root-caused via DOM inspector
- (a) Logo shrunk 120px → 68px. The 120px logo was the real cause of header height, not leftover padding (confirmed: computed box was 120x120).
- (b) Nav menu given `flex-wrap: nowrap`. 6 tabs were wrapping ("Contact" dropping to its own row) because the right-side grid section has no width floor forcing them onto one line.
- (c) bgwave `background-image` on `.site-header` REMOVED. bg-wave.png is a tall portrait full-bleed graphic (~1024x1536), not a thin strip asset — squashing it to `background-size: 100% 80px` was always going to look like a smear, confirmed by viewing the actual file. Reapplied instead as a subtle full-bleed layer BEHIND `.gg-page-header`'s gradient (low opacity, gradient stays visually dominant on top).

**Notes carried from this version:**
- Not fixed, needs editor action: Resources page has empty `gg-res-row` blocks between real link rows (confirmed via DOM inspector — real empty nodes in the page content, not a CSS spacing artifact). Delete them in the block editor's List View. No CSS rule can fix content that isn't there.
- bg-wave.png is 1.9MB on disk. Recompression to a web-friendly size (target under 150KB) is recommended regardless of where it's used. **Still outstanding as of 1.4.9.**

### 1.4.5 — Map page support (merged from parallel session)
- (a) `nav-map` tab added to nav class list, grouped with Resources/Contact (orange stripe).
- (b) New `gg-map-card` component (embed frame, Open Full Map pill button, 3-up info grid built on `gg-card-icon`) for the new `/map` page. Reuses existing variables/components only — no new color tokens introduced.
- No 1.4.4 header/logo/bgwave fixes were touched.

### 1.4.6 — Map tip callout
Added `gg-map-tip`: small gold callout (per locked color rules, sun is tip-boxes only) on the `/map` page, instructing visitors to tap map elements for names/details.

### 1.4.7 — Map tip icon bugfix
`gg-map-tip` icon had no sizing rule, so a raw emoji rendered at full text scale instead of matching the ~18px line-icon system. Added `.gg-map-tip svg` sizing rule.

### 1.4.8 — Mobile title + nav stacking (first pass)
Root-caused via DOM inspector, two mobile-only bugs:
- (a) Site title ("GGPoGo.com") was wrapping letter-by-letter on mobile — computed box was ~36px wide with no white-space rule. Fixed with flex-basis + `white-space: nowrap` + ellipsis fallback, scoped to `max-width: 768px`.
- (b) Section 7's false comment claimed folder tabs were "desktop-only" — WRONG. Astra's mobile hamburger menu reuses the same `.main-header-menu` markup, so the folder-tab `flex-wrap: nowrap` + tab-shape rules had no media guard and were fighting Astra's own `stack-on-mobile` column layout, producing a ragged wrapped tab-grid instead of a stacked list ("About" bleeding off-screen). Fixed with an explicit mobile override: `flex-direction: column`, full-width rows, top stripe (`::before`) repositioned to a 3px left-edge color bar instead of removed, so stripe-color grouping still reads on mobile.

**Known issue found after shipping 1.4.8:** the mobile nav selector used `#ast-hf-mobile-menu ul.main-header-menu` (ID as an ancestor wrapping a nested `<ul>`) — but DOM inspection confirmed `#ast-hf-mobile-menu` **is** the `<ul>` itself, so the selector matched nothing and none of the 1.4.8 mobile-nav rules applied. The `flex-direction: column` stacking visible in testing was actually Astra's own native `stack-on-mobile` behavior, not this stylesheet. Fixed in 1.4.9.

**Also identified (WordPress config, not CSS):** the mobile off-canvas menu was showing 8 items in the wrong order (including a stray tagline row and Privacy Policy/Event Tools that shouldn't be in primary nav) even though the "Main Menu" in Appearance → Menus was correctly built and assigned to Primary Menu. Root cause: Astra's **Off-Canvas Menu** location (a separate slot from Primary Menu, set under Astra → Customize → Header Builder → Off-Canvas Menu → Configure Menu from Here) had no menu explicitly assigned ("— Select —"), causing an undocumented fallback behavior. Fixed by assigning "Main Menu" to the Off-Canvas Menu location as well.

### 1.4.9 — Mobile nav selector fix (corrected 1.4.8)
Corrected the v1.4.8 mobile nav fix, which shipped with a selector bug: `#ast-hf-mobile-menu` was treated as a wrapper containing a nested `ul.main-header-menu`, but DOM inspection confirmed `#ast-hf-mobile-menu` **is** the `<ul>` itself — so none of 1.4.8's mobile-nav rules ever matched, and the folder-tab desktop styling (background, padding, top-stripe) was still rendering on mobile even though items happened to stack (that was Astra's own native `stack-on-mobile` behavior, not this stylesheet). Fixed with the confirmed real selector chain: `ul#ast-hf-mobile-menu.main-header-menu > li.menu-item > a.menu-link`, including the `::before` stripe (now correctly overridden from top-bar to left-edge bar with left/right/border-radius all reset, not just top/width/height as before).

Separately (WordPress admin, not CSS): identified and fixed the cause of the mobile menu showing 8 wrong items in the wrong order — Astra's Off-Canvas Menu location had no menu assigned, causing a fallback that pulled in stray items instead of mirroring Primary Menu. Fixed by assigning Main Menu to the Off-Canvas Menu location too (Astra → Customize → Header Builder → Off-Canvas Menu → Configure Menu from Here).

---

**Sourcing note:** the 1.5.0 entry below was backfilled from that version's in-file changelog header (captured before it was overwritten by 1.5.1's delivery) rather than from delivery notes written at the time — a prior session's closing note here had declared changelog entries would stop and live only in the CSS file's in-file header, which is inconsistent with the project convention that the in-file header carries only the latest version and this file carries full history. That note has been removed and the convention resumes below.

### 1.5.0 — Site title wordmark styling
Site title ("GGPoGo.com") was plain default sans-serif with no color. Now: Fredoka font, 600 weight, 1.35rem (was default browser size, ~1rem-ish), brand blue (`--gg-blue`), with a subtle hover transition to `--gg-blue-deep`.

**Scoped note:** a true multi-color split ("GG" blue / "PoGo" navy / ".com" green, as shown in the design mockup) is NOT deliverable via CSS alone — WordPress renders Site Title as one plain-text string with no per-word spans, so there's nothing for color rules to target individually. Shipped single-color instead of a rule that silently can't do what it claims. A true multi-tone version would need a child-theme template edit or a small JS wrap script, not a stylesheet change — flag if that's wanted later.

The mobile-scoped 1.1rem override (set in v1.4.8, Section 26) still applies on top of this and is unaffected.

### 1.5.1 — Map page title shakedown
Added `.page-id-319` to Section 24's title-hiding list now that the Map page is published (page ID 319), matching the treatment already applied to Home/About/Events/Resources/Contact/Event Tools. Also removed Section 24's now-stale "TODO: once the new Map page is published..." note, since that condition is now met.

### 1.5.2 — Event Tools page weight reduction (bg-wave)
Prompted by a concern that `/event-tools/` may be loading slowly for users on lower-spec devices or slower connections. Investigated the actual asset weight of the page and found `bg-wave.png` — the `.gg-page-header::before` texture layer shared across Home/Events/Resources/Event Tools/Map — is **1.86MB**, despite rendering at only 14% opacity with `mix-blend-mode: overlay`. This was already flagged as an outstanding issue back in the 1.4.9 entry above ("recompression to under 150KB recommended... still outstanding") but never actioned.

Two things came out of this:
1. **CSS change (this release):** added `.page-id-149 .gg-page-header::before { background-image: none !important; }` so Event Tools specifically drops the texture layer entirely — the `.gg-page-header` gradient background itself is untouched, only the decorative overlay is removed. Other `gg-page-header` pages are unaffected by this rule.
2. **Image recompression (not a CSS change — needs manual upload):** downloaded the live `bg-wave.png`, confirmed it's a flat-color wavy gradient graphic (1024×1536, no fine detail/photographic content), and recompressed it as WebP. At quality 75 it comes out to **9.3KB — a 99.5% reduction** — verified visually indistinguishable from the original at the 14% opacity/overlay-blend it's actually shown at. Delivered as `delivery-assets/bg-wave.webp` in the project working directory (an `-optimized.png` alternative at ~199KB is also available if staying in PNG format and reusing the exact same file path/URL is preferred over introducing a new `.webp` URL). This benefits every `gg-page-header` page once uploaded to the Media Library and the CSS `url()` above is repointed at it — not yet done, pending Eric's upload and the resulting URL.
