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

*Entries from 1.5.0 onward are documented only in the in-file header of the corresponding CSS file.*
