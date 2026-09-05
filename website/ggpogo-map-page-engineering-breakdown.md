# GGPoGo.com — Map Page Engineering Breakdown
**Session date:** June 30, 2026
**Scope:** New `/map` page (Google My Maps embed) + supporting stylesheet changes
**Companion docs:** `ggpogo-website-handoff.md` (general site handoff), site-wide stylesheet versions in project files

---

## 1. What Was Built

A new page, **Garden Grove PoGo Map**, was added to ggpogo.com to host an embedded Google My Maps view of points of interest around Garden Grove Park (PokéStops, Gyms, Power Spots, campsite locations, community-contributed markers).

The page reuses the unified cross-site design system (`gg-page-header`, `gg-section-label`, `gg-card-icon`, `gg-cta-band`) rather than introducing a standalone visual style, so it matches Home/Events/Resources instead of becoming a fifth visual language on the site.

**Live components:**
- `gg-page-header--short` hero (title + description)
- `gg-map-card` — paper-card wrapper containing:
  - Card header (heading + "Open Full Map" button, opens the My Maps viewer in a new tab)
  - `gg-map-tip` — small gold callout instructing visitors they can tap any map icon/highlighted area for details
  - `gg-map-embed-wrap` — responsive iframe frame holding the embedded map
- `gg-map-info-grid` — 3-up info card row (What's on the map / Best on the go / Community maintained), each using the site's standard `gg-card-icon` treatment
- `gg-cta-band--blue` — closing CTA linking to `/events`

---

## 2. Current File Versions

| File | Version | Purpose |
|---|---|---|
| `ggpogo-map-page-v1_3.html` | 1.3 | Custom HTML block content for the `/map` page |
| `ggpogo-site-styles-v1_4_7.css` | 1.4.7 | Full site-wide stylesheet (Additional CSS) |

Both are **full-file replacements** — paste the CSS into Appearance → Customize → Additional CSS first, then paste the HTML into a single Custom HTML block on the Map page, in that order.

---

## 3. Stylesheet Changes Introduced This Session

The stylesheet went through several versions this session. Two parallel Claude chats had been working on it independently (a header/logo/nav-overflow fix landed in a separate session as v1.4.4), so part of this work was reconciling that branch rather than working from a single linear history.

| Version | Change |
|---|---|
| v1.4.3 | First pass: added `nav-map` tab (orange stripe) and `gg-map-card` component, built from a v1.4.2 base |
| v1.4.4 | *(built in a parallel session — not this one)* Header/logo sizing, bgwave rework, nav `flex-wrap: nowrap` fix |
| v1.4.5 | Merged: took v1.4.4 as the base and re-applied the `nav-map` tab + `gg-map-card` component on top, without touching the 1.4.4 fixes |
| v1.4.6 | Added `gg-map-tip` — gold callout box (gold/sun is reserved for tip content per the locked color rules) for the "tap to explore" instruction |
| v1.4.7 | Bug fix: the tip box's icon had no sizing rule, so a raw emoji rendered at full text scale instead of matching the ~18px line-icon system. Added explicit `svg` sizing + `flex-shrink: 0` to `gg-map-tip` |

**New CSS added (present in v1.4.7):**
- `.nav-map` added to the orange "reference/connection" stripe group (grouped with Resources/Contact)
- `.gg-map-card`, `.gg-map-card-header`, `.gg-map-open-btn`, `.gg-map-embed-wrap`, `.gg-map-help` — the embed card component
- `.gg-map-tip` (+ `svg` sizing rule) — the gold tip callout
- `.gg-map-info-grid`, `.gg-map-info-card` — the 3-up info row
- Mobile breakpoint (`max-width: 760px`) for all of the above

All new rules reuse existing CSS custom properties (`--gg-blue`, `--gg-orange`, `--gg-paper`, etc.) — no new color tokens were introduced.

---

## 4. HTML Changes Introduced This Session

| Version | Change |
|---|---|
| v1.0 | Initial `/map` page markup |
| v1.1 | Added the `gg-map-tip` tap-to-explore instruction line above the embed |
| v1.2 | Info-grid icons switched from emoji (📍🚶🛠️) to inline Lucide-style line-icon SVGs inside `gg-card-icon`, matching Discord/Instagram/Campfire treatment used on Resources |
| v1.3 | Tip-box icon switched from a raw 👆 emoji (rendering oversized, no matching CSS rule existed) to an inline Lucide "info" line-icon, consistent with the rest of the page |

---

## 5. Known Issue Found — Not Yet Fixed

**Nav bar overflow / dropdown.** Independently of this Map work, Eric had nested **Map** and **Event Tools** under a **Resources** dropdown to solve nav bar crowding. The dropdown rendered using the folder-tab styling (built only for a single flat row of top-level tabs), which looked visually inconsistent as a two-level menu.

**Decision reached this session (not yet implemented in code):**
- Do **not** nest Map under Resources — Map is high-frequency (used mid-event, on mobile) and deserves top-level, one-tap access, same tier as Events.
- **Event Tools** is host-facing and lower-frequency for general visitors — replace its top-level nav slot with **Map** instead.
- Resulting primary nav: **Home — Events — Map — Resources — About — Contact** (flat, six tabs, no dropdown).
- Event Tools remains accessible via direct URL / footer link / Resources page content, just not a primary nav tab.

**Next session should:**
1. Update Appearance → Menus: remove Event Tools from primary nav, add Map in its place, set CSS class `nav-map` (stripe rule already exists in v1.4.7 — orange, "reference/connection" group).
2. Remove the now-unnecessary Resources dropdown nesting.
3. Confirm the six-tab flat row fits comfortably at common breakpoints (the `flex-wrap: nowrap` fix from v1.4.4 was tuned around a specific tab count — recheck at ~1024px and ~900px widths after the swap).
4. Decide where Event Tools link should live instead (footer, Resources page body, or an icon-button near the logo were discussed as options — not decided).

---

## 6. Outstanding Follow-Ups (Carried Over)

- **Page title hiding:** Once the Map page is live, get its WordPress page ID and add it to the `.page-id-NNN .entry-title { display: none; }` list in section 24 of the stylesheet (the `gg-page-header` already displays the title visually, so the default Astra title would otherwise duplicate it).
- **My Maps sharing permissions:** Confirm the Google My Maps map is shared as "Anyone with the link can view" — if still restricted, the embed and "Open Full Map" link will fail for logged-out visitors.
- **bg-wave.png size:** Noted during the v1.4.4 merge as unrelated technical debt — the file is ~1.9MB on disk; recompressing to under ~150KB was recommended regardless of where it's used.

---

## 7. File Manifest (This Session's Deliverables)

- `ggpogo-map-page-v1_3.html` — current Map page Custom HTML block content
- `ggpogo-site-styles-v1_4_7.css` — current full site stylesheet

*Any future delivery on either file must increment its version — no exceptions, per project convention.*
