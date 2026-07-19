# GGPoGo.com — Website Redesign Technical Handoff
**Version 3.0 | June 26–27, 2026**
*Consolidated reference covering the full homepage and events page redesign. Supersedes v2.0.*
*Sources: Claude session (homepage + events page build) + Nyx session (events calendar fix).*

---

## 1. Session Summary

Two back-to-back sessions redesigned the public-facing website at ggpogo.com from a basic placeholder layout into a polished, branded community hub.

**Claude session (June 26):**
- Full homepage redesign — Concept B: Bold Welcome
- Events page redesign — initial build with Google Calendar integration
- Site-wide CSS consolidated into a single versioned stylesheet
- Footer rebuilt with social links and privacy policy
- Google Calendar API setup, key creation, and initial debugging
- Root cause of WordPress JS corruption identified (`@` → syntax error)

**Nyx session (June 26–27):**
- Identified two additional sanitizer risks in the events page script: raw `&&` and manual `&` query concatenation
- v2.5: Rebuilt script with sanitizer-safe patterns, restoring dynamic calendar loading
- v2.6: Upgraded recurring card links from calendar month view to direct event links via `match.htmlLink`
- Added keyboard accessibility (role, tabindex, Enter/Space handlers) to clickable cards
- Confirmed Google Calendar CSP console warning is harmless (report-only, non-blocking)

---

## 2. Current Production Files

| File | Version | Purpose | Status |
|------|---------|---------|--------|
| `ggpogo-site-styles-v1.2.2.css` | 1.2.2 | All site CSS — paste into Additional CSS | ✅ Current |
| `homepage-b-sections-v3.html` | v3 | Homepage Custom HTML block (below hero) | ✅ Current |
| `events-sections-v2.6.html` | v2.6 | Events page Custom HTML block (below hero) | ✅ Current |

All prior versions are superseded. Do not mix versions.

---

## 3. CSS Stylesheet — `ggpogo-site-styles-v1.2.2.css`

### Location
**Appearance > Customize > Additional CSS** — select all and replace on every update.

### Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial design system: fonts, CSS variables, header, buttons, stat cards, feature cards, section accents, resources page, about page, contact page, footer baseline |
| 1.1.0 | Homepage Concept B: hero gradient, inline stats, page title hide for page ID 8 |
| 1.2.0 | Events page hero (shorter, blue-only gradient), events title hide placeholder |
| 1.2.1 | Footer overhaul: broader Astra selectors, `.gg-footer` widget styles, social pill links, privacy policy |
| 1.2.2 | Footer layout fix: `!important` flex overrides, social links forced horizontal, mobile stack rule |

### Section Map (22 sections)

| # | Section | Notes |
|---|---------|-------|
| 1 | Fonts | `@import` Fredoka + Nunito from Google Fonts |
| 2 | CSS Variables | All `--gg-*` tokens: colors, radii |
| 3 | Global Typography | `body`, headings, `p`, `li` |
| 4 | Page Background | `#FFFCF2` warm paper on all pages |
| 5 | Header | White bg, paper-edge bottom border, Fredoka nav |
| 6 | Cover Blocks (general) | Centered flex inner container |
| 7 | Buttons | Fredoka, pill shape, hover lift |
| 8 | Stat Cards | `.gg-stats-row` — white card columns, blue numbers |
| 9 | Feature Cards | `.gg-feature-card` — hoverable, blue border on hover |
| 10 | Section Accents | `.gg-section-green`, `.gg-section-blue`, `.gg-paper-card` |
| 11 | Resources Page | `.gg-resource-section` + color modifier classes |
| 12 | About Page | `.gg-ambassador-card`, `.gg-what-we-do` |
| 13 | Contact Page | `.gg-social-section` |
| 14 | Footer | Navy bg, `.gg-footer` layout, `.gg-footer-socials` pills |
| 15 | Homepage Hero | `.gg-hero-b` — green→blue→navy gradient, 560px min-height |
| 16 | Homepage Stats | `.gg-hero-stats` — gold numbers, dividers, `white-space: nowrap` |
| 17 | Homepage Title Hide | `.page-id-8 .entry-title { display: none }` |
| 18 | (reserved) | — |
| 19 | Events Hero | `.gg-hero-events` — blue→navy gradient, 220px min-height |
| 20 | Events Title Hide | **`.page-id-EVENTS_ID`** — placeholder, replace with real ID |
| 21 | Smooth Scrolling | `html { scroll-behavior: smooth }` |
| 22 | Mobile Breakpoints | All `@media (max-width: 768px)` rules consolidated here |

### Outstanding CSS Task
Section 20 contains `.page-id-EVENTS_ID` as a placeholder. Find the Events page ID in WordPress (editor URL: `post=XX`) and replace `EVENTS_ID` with the real number, then republish.

---

## 4. Homepage

**URL:** https://ggpogo.com/
**WordPress Page ID:** 8

### WordPress Block Structure

```
Cover block [class: gg-hero-b]
  ├── Image — logo mark (cropped-logo-no-text.png), 72px, centered
  ├── Heading H1 — "Catch together. Win together." (white, centered)
  ├── Paragraph — subtitle (white 70%, centered)
  ├── Buttons block (centered)
  │   ├── "Join us on Discord" → discord.gg/xk6AgkMgtv (green fill)
  │   └── "See what's next" → /events/ (white outline)
  └── Columns [class: gg-hero-stats] — 3 equal columns
      ├── H3 "6,900+" / P "Trainers"
      ├── H3 "75+" / P "Meetups"
      └── H3 "Est. 2024" / P "Founded"

Custom HTML block → homepage-b-sections-v3.html
```

### `homepage-b-sections-v3.html` Content

| Section | Description |
|---------|-------------|
| Activity strip | 4 horizontally scrollable icon cards: Raid Hours, Giveaways, Community Days, Trading. `overflow-y: visible` + padding prevents hover clipping. |
| Story card | "Built by trainers, for trainers." Heart SVG icon. Links to `/about/`. |
| Duo cards | Left: Next Event card (dynamic). Right: Campfire CTA (orange button, deep link). |
| Calendar script | Fetches 1 upcoming event. Updates title, date badge (day name / number / month), details line, and location. Silently falls back to static content on failure. |

### Homepage Calendar Script

```javascript
// maxResults=1, updates featured card only
var CALENDAR_ID = '...ID...\u0040group.calendar.google.com';
var API_KEY     = 'AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc';
```

Fallback static content: "Weekly Raid Hour / Every Wednesday at 6:00 PM / Atlantis Play Center area"

---

## 5. Events Page

**URL:** https://ggpogo.com/events/

### WordPress Block Structure

```
Cover block [class: gg-hero-events]
  ├── Heading H1 — "Events" (white, centered)
  └── Paragraph — intro text (white 65%, centered)

Custom HTML block → events-sections-v2.6.html
```

### `events-sections-v2.6.html` Content

| Section | Description |
|---------|-------------|
| Featured event card | Date badge (short day / day number / month abbr) + "Up next" eyebrow + event title + datetime line + location (hidden if blank) + Discord RSVP button |
| Recurring events grid | 3-column card grid. Each card has `data-keywords` attribute. On match: card becomes clickable (links to event's `htmlLink`), "Next:" preview line appears below subtitle |
| Full calendar embed | Google Calendar iframe in white rounded card. `showTitle=0`, `color=%231FA5DC` (brand blue). `loading="lazy"` |
| Discord + Campfire CTA | "Don't miss an event" green/tinted card, two buttons side by side |

### Recurring Card Keyword Configuration

| Card | `data-keywords` | Exclusion |
|------|----------------|-----------|
| Raid Hour | `raid hour` | Skips events whose title also contains `raid day` |
| Community Day | `community day` | None |
| Special Events | `go fest\|go tour\|go wild\|raid day\|max battle day` | None |

Matching is case-insensitive substring (`.indexOf()`). First match wins. Event title format from calendar: `[Pokemon] Raid Hour`, `[Pokemon] Community Day`, etc.

### Events Calendar Script — v2.6 Final Architecture

```javascript
// 1. Define credentials
var CALENDAR_ID = '...ID...\u0040group.calendar.google.com';
var API_KEY     = 'AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc';

// 2. Build URL using URL + searchParams (sanitizer-safe — no raw & in source)
var urlObj = new URL('https://www.googleapis.com/calendar/v3/calendars/'
  + encodeURIComponent(CALENDAR_ID) + '/events');
urlObj.searchParams.set('key', API_KEY);
urlObj.searchParams.set('timeMin', now);
urlObj.searchParams.set('maxResults', '30');
urlObj.searchParams.set('singleEvents', 'true');
urlObj.searchParams.set('orderBy', 'startTime');

// 3. Fetch → update featured card (first event) + recurring cards (keyword scan)

// 4. Recurring card links use match.htmlLink (direct event link)
//    with calUrl(yr, mo) as month-view fallback

// 5. Accessibility: role="link", tabindex="0", aria-label, Enter/Space keydown
```

### Events HTML Version History

| Version | Key Change |
|---------|-----------|
| v1 | Initial build: static featured card, recurring grid, calendar iframe, CTA |
| v2 | Recurring cards dynamic: keyword matching, clickable month links, "Next:" preview |
| v2b | API key hardcoded, guard clause removed, static fallback text improved |
| v2.3 | Verbose `[GGPoGo]` console logging added for diagnostics |
| v2.4 | **Fixed:** Raw `@` in Calendar ID → `\u0040`. Resolved WordPress SyntaxError at column 33 |
| v2.5 | **Fixed:** Raw `&&` → nested `if`. Raw `&` query string → `URL`+`searchParams`. Restored dynamic loading |
| v2.6 | **Improved:** Card links now use `match.htmlLink` (direct event) instead of month view. Keyboard accessibility added (role, tabindex, Enter/Space) |

---

## 6. Google Calendar Integration

### Credentials

| Item | Value |
|------|-------|
| Calendar ID | `0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc@group.calendar.google.com` |
| API Key | `AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc` |
| Google Cloud Project | `ggpogo-tools-us` |
| API Key Restriction | HTTP referrers: `https://ggpogo.com/*` and `https://www.ggpogo.com/*` |
| API Scope | Google Calendar API only |

### Calendar must remain public
Google Calendar > Settings for GGPoGo Events > Access permissions > "Make available to public" must be checked. If unchecked, all API calls return 403.

### API Request Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `key` | API key above | Authenticates the request |
| `timeMin` | Current ISO timestamp | Only return upcoming events |
| `maxResults` | `30` | Enough to find matches for all card types |
| `singleEvents` | `true` | Expands recurring events into individual instances |
| `orderBy` | `startTime` | Chronological order |

---

## 7. WordPress Sanitizer Rules — Critical

This is the most important section for future development. The WordPress Custom HTML block runs content through a sanitizer that corrupts specific patterns inside `<script>` tags. Every JS file delivered for this project must comply with these rules.

| Pattern | Risk | Required workaround |
|---------|------|---------------------|
| Raw `@` in JS strings | WordPress throws `SyntaxError: Invalid or unexpected token` — kills entire script | Use `\u0040` |
| Raw `&&` in JS | May become `&#038;&#038;`, breaking logic | Use nested `if` statements |
| Raw `&` in query string concatenation | May become entity-encoded | Use `URL` + `searchParams.set()` |
| Raw `&` in HTML `href` attributes | Becomes `&#038;` | Use `&amp;` in all HTML attributes |
| Raw `<svg>` in Footer Builder HTML widget | Astra strips SVG tags | Use text links styled as pills |

**The one rule to remember:** Never concatenate `&` manually inside a `<script>` block in a WordPress Custom HTML block. Use the `URL` API instead.

---

## 8. Footer

### Setup
**Appearance > Customize > Footer Builder > Primary Footer row**
- Columns: 1
- Width: Full Width
- Background color: `#0D2D52` (set on Design tab of the row)
- Inner Elements Layout: Inline
- Component: HTML 1 widget

### Footer HTML (current production)

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

Note: Social links are text ("Discord", "Instagram", "Campfire") styled as pill buttons via `.gg-footer-socials a` in the CSS. SVG icons were tried first but Astra's Footer Builder HTML widget strips them.

### Below Footer row
Must be emptied or disabled in Footer Builder to prevent the old Astra copyright line from rendering below the custom footer.

---

## 9. Cache Purging — Always Two Steps

After any content, CSS, or HTML change:

1. WordPress admin bar → **Purge SG Cache** (SiteGround)
2. Cloudflare dashboard → Caching → **Custom Purge** → `ggpogo.com`

Skipping either step frequently leaves stale content visible regardless of what was published.

---

## 10. Console Diagnostics

The events page script logs to the browser console with the `[GGPoGo]` prefix. Open DevTools (F12) > Console tab to read them.

| Message | Meaning |
|---------|---------|
| `[GGPoGo] Calendar fetch starting...` | Script executed successfully, fetch is running |
| `[GGPoGo] HTTP status: 200 OK` | API responded successfully |
| `[GGPoGo] HTTP status: 403 Forbidden` | API key referrer restriction is blocking the request |
| `[GGPoGo] API error: ...` | Google returned an error object — check key and calendar public status |
| `[GGPoGo] Events found: N` | N events were returned |
| `[GGPoGo] Calendar fetch FAILED: ...` | Network error or script exception |
| No `[GGPoGo]` messages at all | Script didn't run — WordPress sanitizer likely corrupted JS |

### Harmless console warning (can be ignored)
```
Framing 'https://calendar.google.com/' violates the following report-only
Content Security Policy directive: "frame-ancestors 'self'".
The violation has been logged, but no further action has been taken.
```
This is a **report-only** CSP message from Google. It does not block the iframe or affect any functionality.

---

## 11. Debugging Guide — If Events Calendar Breaks

Check in this order:

1. Open browser console. Look for `[GGPoGo]` messages or syntax errors.
2. If no `[GGPoGo]` messages: WordPress sanitizer corrupted the JS. Check for raw `@`, `&&`, or `&` in the script and fix per Section 7.
3. If `403 Forbidden`: Calendar is no longer public, or API key referrer restrictions don't match the current domain.
4. If `200 OK` but no events: Check that `timeMin` is correct and the calendar has future events.
5. If events load but recurring cards don't update: Check that event titles still contain the expected keywords (e.g. "Raid Hour", "Community Day").
6. Confirm the deployed Custom HTML is actually v2.6 (not a cached older version) by checking the version comment at the top of the block.
7. Confirm both SiteGround and Cloudflare caches were purged after the last edit.

---

## 12. Community Links — Quick Reference

| Resource | Value |
|----------|-------|
| Discord | `https://discord.gg/xk6AgkMgtv` |
| Instagram | `https://www.instagram.com/gardengrovepogo/` |
| Campfire deep link | `https://campfire.onelink.me/eBr8?af_dp=campfire://&af_force_deeplink=true&deep_link_sub1=cj1jbHVicyZjPTM3NzgzYzEyLWYzNWYtNDg4Yy04ZmQxLTM2ZWEyYjJlNGE0ZCZpPXRydWU=` |
| Calendar ID | `0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc@group.calendar.google.com` |
| Calendar API Key | `AIzaSyAQjDnfy-kcFX4T6yyq96fgw5RWTze6Xdc` |
| Logo mark | `https://ggpogo.com/wp-content/uploads/2026/05/cropped-logo-no-text.png` |
| Logo wordmark | `https://ggpogo.com/wp-content/uploads/2026/05/logo-full.png` |
| Community email | `gardengrovepogo@gmail.com` |
| Privacy policy | `https://ggpogo.com/privacy-policy/` |

---

## 13. Outstanding Issues

### Must-do before next session

- [ ] Replace `EVENTS_ID` placeholder in CSS section 20 with the actual Events page ID
- [ ] Fix Raid Hour time in Google Calendar from 5:45 PM to 6:00 PM

### Remaining pages (not yet redesigned)

- [ ] **About page** — delete empty blocks (List View), reattach ambassador photos, add `gg-what-we-do` class, add Discord button to CTA, add `gg-ambassador-card` class to ambassador columns
- [ ] **Resources page** — wrap sections in Group blocks with `gg-resource-section` + color modifier classes
- [ ] **Contact page** — align Campfire icon with Discord/Instagram icons horizontally
- [ ] **Event Tools page** — consider password protection (WordPress page settings > Password)

### Future / nice-to-have

- [ ] Externalize events JS to a `.js` file or custom plugin (avoids Custom HTML sanitizer entirely)
- [ ] Custom branded calendar UI using Calendar API data (replaces iframe, eliminates CSP warning)
- [ ] Homepage Next Event card upgraded to same dynamic approach as events page
- [ ] Public stats dashboard page
- [ ] Footer SVG icons (requires Astra Pro or custom plugin to bypass Footer Builder sanitizer)

---

## 14. Events Page Validation Checklist

Run after any future events page update.

**Layout**
- [ ] Header and nav display correctly
- [ ] Events hero displays correctly (blue-navy gradient, no green)
- [ ] Only one "Events" title visible (CSS hide working)
- [ ] Featured event card appears below hero
- [ ] Recurring cards display in 3-column grid on desktop, 1-column on mobile
- [ ] Google Calendar iframe loads and shows events
- [ ] Discord + Campfire CTA displays at bottom

**Dynamic data**
- [ ] Featured card populates with next upcoming event (title, date, time, location)
- [ ] Date badge updates (day name / number / month)
- [ ] Location line is hidden when the event has no location
- [ ] Raid Hour card shows "Next:" line with next Raid Hour
- [ ] Community Day card shows "Next:" line with next Community Day
- [ ] Special Events card shows "Next:" line with next special event (or blank if none in next 30)

**Links and interactions**
- [ ] Raid Hour card click → opens that specific Raid Hour event in Google Calendar
- [ ] Community Day card click → opens that specific Community Day event
- [ ] Special Events card click → opens that specific special event
- [ ] Cards without a match are not clickable
- [ ] Clickable cards are keyboard-accessible (Tab, Enter, Space)
- [ ] Discord RSVP button → discord.gg/xk6AgkMgtv (new tab)
- [ ] Campfire button → Campfire deep link (new tab)

**Console**
- [ ] `[GGPoGo] Calendar fetch starting...` present
- [ ] `[GGPoGo] HTTP status: 200 OK` present
- [ ] `[GGPoGo] Events found: N` present (N > 0)
- [ ] No JavaScript syntax errors
- [ ] CSP report-only warning (if present) confirmed harmless

---

*Consolidated June 26–27, 2026. Combines Claude session (v2.0) and Nyx session (calendar fix v1.0).*
*Next handoff should increment to v4.0 and cover the remaining page rebuilds.*
