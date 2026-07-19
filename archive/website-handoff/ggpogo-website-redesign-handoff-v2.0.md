# GGPoGo.com — Website Redesign Technical Handoff
**Version 2.0 | June 26, 2026**
*Covers the full homepage and events page redesign session. Picks up where `ggpogo-website-handoff.md` left off.*

---

## 1. Session Summary

This session redesigned the public-facing website at ggpogo.com from a basic placeholder layout into a polished, branded community hub. Work covered:

- Full homepage redesign (Concept B: Bold Welcome)
- Events page redesign with dynamic Google Calendar integration
- Site-wide CSS consolidation into a single versioned stylesheet
- Footer rebuild with social links and privacy policy
- Google Calendar API setup and debugging

---

## 2. File Deliverables — Current Production Versions

| File | Version | Purpose |
|------|---------|---------|
| `ggpogo-site-styles-v1.2.2.css` | 1.2.2 | Full site-wide CSS — paste into Additional CSS |
| `homepage-b-sections-v3.html` | v3 | Homepage Custom HTML block (below hero) |
| `events-sections-v2.4.html` | v2.4 | Events page Custom HTML block (below hero) |

All prior versions are superseded. Only the versions above should be live.

---

## 3. CSS Stylesheet — `ggpogo-site-styles-v1.2.2.css`

### Location
**Appearance > Customize > Additional CSS** — replace all contents with this file on every update.

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jun 2026 | Initial design system (fonts, variables, header, buttons, stat cards, feature cards, section accents, resources, about, contact, footer baseline) |
| 1.1.0 | Jun 25 2026 | Homepage Concept B hero gradient, inline stats styling, page title hide for page ID 8 |
| 1.2.0 | Jun 26 2026 | Events page hero (shorter, blue-only gradient), events page title hide placeholder |
| 1.2.1 | Jun 26 2026 | Footer overhaul: broader Astra selectors, custom `.gg-footer` widget styles, social pill links, privacy policy link |
| 1.2.2 | Jun 26 2026 | Footer layout fix: `!important` on flex rules to override Astra centering; social links horizontal; mobile stack rule added |

### Section Map (22 sections)

| # | Section | Key Classes |
|---|---------|-------------|
| 1 | Fonts | `@import` Fredoka + Nunito |
| 2 | CSS Variables | `--gg-blue`, `--gg-green`, `--gg-orange`, `--gg-sun`, `--gg-paper`, `--gg-ink`, etc. |
| 3 | Global Typography | `body`, `h1`–`h6`, `p`, `li` |
| 4 | Page Background | `#FFFCF2` warm paper on all pages |
| 5 | Header | White bg, paper-edge border, Fredoka nav links |
| 6 | Cover Blocks (general) | Centered inner container |
| 7 | Buttons | Fredoka font, pill shape, hover lift |
| 8 | Stat Cards | `.gg-stats-row` — white card columns with blue numbers |
| 9 | Feature Cards | `.gg-feature-card` — hoverable white cards with blue border on hover |
| 10 | Section Accents | `.gg-section-green`, `.gg-section-blue`, `.gg-paper-card` |
| 11 | Resources Page | `.gg-resource-section` + color variants |
| 12 | About Page | `.gg-ambassador-card`, `.gg-what-we-do` |
| 13 | Contact Page | `.gg-social-section` |
| 14 | Footer | Navy bg (`#0D2D52`), `.gg-footer` widget layout, `.gg-footer-socials` pill links |
| 15 | Homepage Hero | `.gg-hero-b` — green→blue→navy gradient, 560px min-height |
| 16 | Homepage Stats | `.gg-hero-stats` — gold numbers, dividers, no-wrap |
| 17 | Homepage Title Hide | `.page-id-8 .entry-title { display: none }` |
| 18 | (reserved) | — |
| 19 | Events Hero | `.gg-hero-events` — blue→navy gradient, 220px min-height |
| 20 | Events Title Hide | `.page-id-EVENTS_ID` — **placeholder, replace with real ID** |
| 21 | Smooth Scrolling | `html { scroll-behavior: smooth }` |
| 22 | Mobile Breakpoints | All `@media (max-width: 768px)` rules consolidated here |

### Outstanding CSS TODO
- Section 20: Replace `EVENTS_ID` with the actual Events page ID (found in editor URL: `post=XX`)

---

## 4. Homepage — Block Structure

**Page:** https://ggpogo.com/ (Page ID: 8)

### Block order (top to bottom)

```
Cover block [class: gg-hero-b]
  ├── Image block — logo mark (cropped-logo-no-text.png), width 72px, centered
  ├── Heading H1 — "Catch together. Win together." (white, centered)
  ├── Paragraph — subtitle text (white 70%, centered)
  ├── Buttons block (centered)
  │   ├── Button: "Join us on Discord" → discord.gg/xk6AgkMgtv (green fill)
  │   └── Button: "See what's next" → /events/ (outline)
  └── Columns block [class: gg-hero-stats] — 3 equal columns
      ├── Column: H3 "6,900+" / P "Trainers"
      ├── Column: H3 "75+" / P "Meetups"
      └── Column: H3 "Est. 2024" / P "Founded"

Custom HTML block → homepage-b-sections-v3.html
```

### `homepage-b-sections-v3.html` — Section Structure

| Section | Description |
|---------|-------------|
| Activity strip | 4 horizontally scrollable cards: Raid Hours, Giveaways, Community Days, Trading. Hover lifts with blue border. |
| Story card | "Built by trainers, for trainers" with heart icon. Links to `/about/`. |
| Duo cards | Left: Next Event (dynamic via Calendar API). Right: Campfire CTA (orange button). |
| Calendar script | Fetches 1 upcoming event. Updates title, date badge, and location on the duo card. |

### Homepage Calendar API (in `homepage-b-sections-v3.html`)

```javascript
var CALENDAR_ID = '0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc\u0040group.calendar.google.com';
var API_KEY     = 'AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc';
```

Fetches `maxResults=1`, updates `#gg-evt-title`, `#gg-evt-datetime`, `#gg-evt-location`. Silently falls back to static content on failure.

**Critical:** The `@` in the Calendar ID is encoded as `\u0040` to prevent WordPress from throwing a JS syntax error during sanitization. Do not change this to a raw `@`.

---

## 5. Events Page — Block Structure

**Page:** https://ggpogo.com/events/

### Block order

```
Cover block [class: gg-hero-events]
  ├── Heading H1 — "Events" (white, centered)
  └── Paragraph — intro text (white 65%, centered)

Custom HTML block → events-sections-v2.4.html
```

### `events-sections-v2.4.html` — Section Structure

| Section | Description |
|---------|-------------|
| Featured event card | Date badge (day/num/month) + event title + datetime + location + Discord RSVP button. Populated dynamically. |
| Recurring events grid | 3-column grid: Raid Hour, Community Day, Special Events. Each card becomes clickable when a match is found, linking to the matching month in Google Calendar. Shows a "Next:" preview line with the matched event title and date. |
| Full calendar embed | Google Calendar iframe in a styled white card container. Color changed from pink to brand blue (`%231FA5DC`). `showTitle=0` hides Google's default header. |
| Discord + Campfire CTA | Green Discord button + orange Campfire button, side by side. |

### Events Calendar API (in `events-sections-v2.4.html`)

```javascript
var CALENDAR_ID = '0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc\u0040group.calendar.google.com';
var API_KEY     = 'AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc';
```

Fetches `maxResults=30`. First event updates the featured card. Then scans all 30 for recurring card matches.

### Keyword Matching Logic

| Card | Keywords (case-insensitive, title contains) | Exclusion |
|------|----------------------------------------------|-----------|
| Raid Hour | `raid hour` | Skips if title also contains `raid day` |
| Community Day | `community day` | None |
| Special Events | `go fest`, `go tour`, `go wild`, `raid day`, `max battle day` | None |

Event title format from your calendar: `[Featured Pokemon] Raid Hour`, `[Featured Pokemon] Community Day`, etc. The keyword match is a `.indexOf()` check so partial matches work correctly.

### Version History — Events HTML

| Version | Changes |
|---------|---------|
| v1 | Initial build: featured card (static), recurring grid, calendar iframe, CTA |
| v2 | Recurring cards become clickable links to matching calendar month; "Next:" preview line added; fetches 30 events |
| v2b | API key hardcoded; guard clause removed; static fallback improved |
| v2.3 | Verbose `[GGPoGo]` console logging for diagnostics |
| v2.4 | **Root bug fixed:** `@` in Calendar ID escaped as `\u0040` — WordPress sanitizer was throwing `SyntaxError: Invalid or unexpected token` at that character, preventing all JS from running |

---

## 6. Google Calendar Integration

### Credentials

| Item | Value |
|------|-------|
| Calendar ID | `0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc@group.calendar.google.com` |
| API Key | `AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc` |
| Google Cloud Project | `ggpogo-tools-us` |
| API enabled | Google Calendar API |
| Key restriction | HTTP referrers: `https://ggpogo.com/*`, `https://www.ggpogo.com/*` |
| Key scope | Google Calendar API only |

### Calendar must be set to public
In Google Calendar > Settings for GGPoGo Events calendar > Access permissions > "Make available to public" must be checked, or all API calls return 403.

### Encoding note
In all JavaScript files, the `@` in the Calendar ID must be written as `\u0040`. WordPress's Custom HTML block sanitizer throws a syntax error on raw `@` characters inside `<script>` tags, killing all subsequent JavaScript.

---

## 7. Footer

### Setup method
Built via **Appearance > Customize > Footer Builder > Primary Footer row**.

- Columns: 1
- Width: Full Width
- Background: `#0D2D52` (set on the row's Design tab)
- Inner Elements Layout: Inline
- Component: HTML 1 widget

### Footer HTML (paste into the HTML widget)

```html
<div class="gg-footer">
  <div class="gg-footer-left">
    <div class="gg-footer-brand">GGPoGo.com</div>
    <div class="gg-footer-copy">
      &copy; 2026 Garden Grove Pokemon GO Community
      &nbsp;&middot;&nbsp;
      <a href="/privacy-policy/">Privacy Policy</a>
    </div>
  </div>
  <div class="gg-footer-socials">
    <a href="https://discord.gg/xk6AgkMgtv" target="_blank" rel="noopener">Discord</a>
    <a href="https://www.instagram.com/gardengrovepogo/" target="_blank" rel="noopener">Instagram</a>
    <a href="https://campfire.onelink.me/eBr8?af_dp=campfire://&amp;af_force_deeplink=true&amp;deep_link_sub1=cj1jbHVicyZjPTM3NzgzYzEyLWYzNWYtNDg4Yy04ZmQxLTM2ZWEyYjJlNGE0ZCZpPXRydWU=" target="_blank" rel="noopener">Campfire</a>
  </div>
</div>
```

### Why text links instead of SVG icons
Astra's Footer Builder HTML widget strips raw `<svg>` tags through its sanitizer. Text links styled as pill buttons via `.gg-footer-socials a` in the CSS are the reliable alternative.

### Below Footer row
The "Below Footer" row in Footer Builder (which shows the old Astra copyright line) should be emptied or disabled. The CSS hides the "Powered by Astra" link but the row itself may still render a blank navy bar if not removed.

---

## 8. Known Issues & Gotchas

### WordPress Custom HTML block sanitization
WordPress corrupts certain characters inside Custom HTML blocks:

| Character | In | Corrupts to | Fix |
|-----------|----|-------------|-----|
| `@` | `<script>` tag | Throws `SyntaxError` | Encode as `\u0040` in JS strings |
| `&` | HTML attributes | `&#038;` | Encode as `&amp;` in href attributes |
| `&&` | JS inside HTML | `&#038;&#038;` | Avoid `&&` in JS; use `&amp;&amp;` or restructure |

### Cache purging — always two steps
After any content or CSS change:
1. WordPress admin bar > **Purge SG Cache** (SiteGround)
2. Cloudflare dashboard > Caching > **Custom Purge** > `ggpogo.com`

Both are required. Purging only one frequently leaves stale content visible.

### Events page title hide
Section 20 of the CSS has `.page-id-EVENTS_ID` as a placeholder. The actual Events page ID must be found (editor URL: `post=XX`) and substituted before the title will be hidden.

### Raid Hour time
Google Calendar still shows 5:45 PM for recurring Raid Hour events. This should be corrected directly in Google Calendar to 6:00 PM.

---

## 9. Community Links (quick reference)

| Resource | Value |
|----------|-------|
| Discord | `https://discord.gg/xk6AgkMgtv` |
| Instagram | `https://www.instagram.com/gardengrovepogo/` |
| Campfire deep link | `https://campfire.onelink.me/eBr8?af_dp=campfire://&af_force_deeplink=true&deep_link_sub1=cj1jbHVicyZjPTM3NzgzYzEyLWYzNWYtNDg4Yy04ZmQxLTM2ZWEyYjJlNGE0ZCZpPXRydWU=` |
| Logo mark | `https://ggpogo.com/wp-content/uploads/2026/05/cropped-logo-no-text.png` |
| Logo wordmark | `https://ggpogo.com/wp-content/uploads/2026/05/logo-full.png` |
| Community email | `gardengrovepogo@gmail.com` |
| Privacy policy | `https://ggpogo.com/privacy-policy/` |

---

## 10. What's Still To Do

### Active / In Progress
- [ ] Verify events-sections-v2.4.html fixes the `SyntaxError` (calendar cards should now populate)
- [ ] Replace `EVENTS_ID` placeholder in CSS section 20 with actual page ID
- [ ] Fix Raid Hour time in Google Calendar from 5:45 PM to 6:00 PM

### Remaining Site Pages
- [ ] **About page** — remove whitespace (empty blocks via List View), reattach ambassador photos, add `gg-what-we-do` class, add Discord button to CTA
- [ ] **Resources page** — wrap sections in Group blocks with `gg-resource-section` + color classes
- [ ] **Event Tools page** — consider password protecting (WordPress page settings > Password)

### Nice to Have
- [ ] Homepage Next Event card — consider dynamic loading same as events page
- [ ] About page — apply `gg-ambassador-card` class to ambassador columns
- [ ] Footer — explore whether Astra Pro allows SVG icons in Footer Builder (would replace text pill links)
- [ ] Public stats dashboard page
- [ ] Raid location map embed for Garden Grove

---

*Generated June 26, 2026. Continues from `ggpogo-website-handoff.md`.*
