# Garden Grove PoGo Event Tools
## Complete Engineering Handoff -- v1.0 through v2.12.20
### June 2026

This is a consolidated, standalone engineering reference covering the entire history of the GGPoGo Event Tools app, from the initial build through the current delivered version, v2.12.20. It folds the full version arc and all carried-forward architecture, gotchas, and open items into one document.

Current delivered file:

```text
wordpress-block-v2_12_20.html
APP_VERSION = "v2.12.20"
```

It supersedes the prior handoff chain as the single entry point, but those documents remain useful for deeper detail on specific sessions:

- `ggpogo-engineering-reference-2_12_2.md` -- exhaustive architecture, data model, rules, component map, and the v1.0 to v2.12.2 version history.
- `ggpogo-engineering-reference-2_12_8.md` -- bonus entries, entry-order numbers, inline confirms, and mobile date-input fixes (v2.12.3 to v2.12.8).
- `ggpogo-engineering-reference-2_12_14.md` -- community auth and QR-flow auth integration (v2.12.9 to v2.12.14).
- `ggpogo-engineering-reference-2_12_15.md` -- Firebase US-region migration (v2.12.15).

---

## Table of contents

1. [What this is and why it exists](#what-this-is-and-why-it-exists)
2. [Architecture overview](#architecture-overview)
3. [Firebase backend and data model](#firebase-backend-and-data-model)
4. [Security rules](#security-rules)
5. [Authentication and profile model](#authentication-and-profile-model)
6. [Visual design system](#visual-design-system)
7. [Feature inventory (current state)](#feature-inventory-current-state)
8. [Complete version history](#complete-version-history)
9. [Key technical gotchas](#key-technical-gotchas)
10. [Pre-delivery checklist](#pre-delivery-checklist)
11. [Firebase configuration reference](#firebase-configuration-reference)
12. [Host role management](#host-role-management)
13. [Google OAuth consent screen](#google-oauth-consent-screen)
14. [Deployment and cache clearing](#deployment-and-cache-clearing)
15. [Open items](#open-items)
16. [Versioning convention](#versioning-convention)
17. [Quick-start for a new session](#quick-start-for-a-new-session)

---

## What this is and why it exists

Garden Grove PoGo is a Pokemon GO community group running recurring meetup events, with a WordPress site at ggpogo.com (SiteGround host, Cloudflare in front). The site owner is a Niantic Community Ambassador, not a professional software developer, who wanted to replicate two features from cameetup.net, a third-party tool used previously.

**Code Drop:** at an event, a host loads a pool of promotional redemption codes. Attendees scan a QR code, enter a trainer name, and each receives one unique unredeemed code plus a direct link to the Pokemon GO store redemption page. One code per device, live claimed/remaining counts, pause/resume, and session history.

**Giveaway/Raffle:** a host defines prizes; attendees enter via QR code (or are added manually by the host); the host runs a live drawing with a slot-machine-style name animation to pick winners per prize.

The owner's constraints defined the architecture: no servers to maintain, no build pipeline, no separate app to install or deploy, no recurring cost beyond what already exists. The result is a single HTML file pasted into a WordPress Custom HTML block at ggpogo.com/event-tools/.

---

## Architecture overview

### Single Custom HTML block

The entire application -- UI, state, and Firebase access -- lives in one HTML file pasted into a WordPress Custom HTML block. No build step, no separate deployment. Updates are: generate new HTML file, paste it over the existing block content, click Update.

The file loads React 18, ReactDOM 18, and Babel Standalone via CDN script tags. The whole app is written as JSX inside a single `<script type="text/babel">` block wrapped in an IIFE. Babel Standalone transpiles the JSX in the browser at page-load time.

Consequences that anyone modifying the file must respect:

- No ES module `import`/`export` syntax. UMD globals only (`React.useState`, `firebase.database()`, etc.). There is no bundler.
- No `require()`. Same reason.
- `const { useState, useEffect, useRef, useMemo } = React;` at the top of the IIFE.
- The Firebase compat SDK (10.13.2) is used, not the modular v9+ SDK. It is CDN-loaded as globals (`firebase.initializeApp`, `firebase.database()`, `firebase.auth()`).
- Fonts (Fredoka headings, Nunito body) are loaded from Google Fonts via `<link>` tags.

### Babel must be pinned and forced to the classic JSX runtime

This is the single most important operational fact about the architecture, learned from two separate production blank-page incidents. The Babel Standalone script tag must always reference an explicit version, never an unversioned alias, and the classic runtime pragma must be the first line inside the script:

```html
<script src="https://unpkg.com/@babel/standalone@7.29.7/babel.min.js"></script>
<script type="text/babel" data-presets="react">
/** @jsxRuntime classic */
(function () {
```

An unpinned `@babel/standalone` reference silently starts serving whatever unpkg currently publishes as latest. Newer releases default to the "automatic" JSX runtime, which emits `import { jsx } from "react/jsx-runtime"` in transformed output -- invalid inside a classic, non-module `text/babel` script, and fatal (a blank page before React ever mounts, so the in-app diagnostics never get the chance to render). The `/** @jsxRuntime classic */` pragma forces classic `React.createElement(...)` output regardless of the library's default; the version pin prevents the drift from recurring.

A local Babel parse check cannot catch a regression here, because the local install always defaults to the classic runtime. Verifying the pin and pragma requires direct inspection of the literal script tag, not inference from a successful parse.

### The FB wrapper

All Firebase reads/writes go through a thin wrapper object `FB`. Every method catches its own errors, calls `reportIssue` to feed the diagnostics system, and never throws to the caller:

```text
FB.get(path)              async -> value or null
FB.set(path, val)         async -> true/false
FB.update(updatesObject)  async -> true/false, atomic multi-path
FB.push(path, val)        async -> new push-key or null
FB.remove(path)           async -> true/false
FB.watch(path, cb)        live listener -> returns unsubscribe fn
FB.transact(path, fn)     transaction wrapper
```

Transaction helpers built on `FB.transact`: `claimCodeNode`, `unclaimCodeNode`, `registerClaim`, `incrementCounter`, `decrementCounter`.

### Client identity

`fingerprint()` (the name is historical) returns a random ID generated once per browser via `crypto.randomUUID()`, persisted in localStorage under `ggpogo_client_id_v1`, returned on every subsequent call. A storage-availability test guards contexts where localStorage throws (private browsing, some in-app browsers), falling back to an in-memory ID for that page load and logging the fallback. This replaced an earlier deterministic hardware-trait hash that collided between different attendees on the same phone model (see v2.12.1 below).

---

## Firebase backend and data model

**Current project:** ggpogo-tools-us (us-central1, United States), Spark (free) plan.

The data model uses object maps rather than arrays wherever per-item security rules are needed.

Code Drop paths:

```text
cd:codes/{id}            { value, claimed, claimedBy, claimedAt, order, expiresAt, reward }
cd:session               { id, paused, claimedCount, limitEnabled, limitValue, eventId, eventName }
cd:claims/{fp}           the code id this device claimed (parent host-only; child publicly readable)
cd:sessionLog/{pushKey}  { name, code, reward, time, fp, uid, entryMode }
cd:settings              public-readable settings
cd:history/{pushKey}     ended-session archive (host-only)
```

Giveaway paths:

```text
gw:session               { id, eventId, eventName }
gw:prizes/{id}           { name, quantity, remaining, type, description, delivery }
gw:entrants/{id}         { name, fp, uid, entryMode, enteredAt, won, extraEntries }
gw:draws                 host-only draw records
gw:history/{pushKey}     ended-giveaway archive (host-only)
gw:templates             saved prize templates (host-only)
```

Community and stats paths:

```text
roles/hosts/{uid}                          boolean host flag (managed in console only)
users/{uid}                                { displayName, email, photoURL, trainerName, ageConfirmed, timestamps }
users/{uid}/trainerName                    public event name
users/{uid}/linkedClientIds/{safeId}       browser client-ID links
users/{uid}/activity/codeClaims/{id}       { code, reward, displayName, claimedAt, eventName, sessionCode, ... }
users/{uid}/activity/giveawayEntries/{id}  { displayName, enteredAt, eventName, sessionCode, ... }
migrations/{oldId}                          legacy write-once migration fallback
settings:branding                          public-readable branding config
stats:settings / stats:cache / stats:snapshots   Meetup Stats (host-only)
```

---

## Security rules

The rules are published on `ggpogo-tools-us`. Full rules JSON is in `ggpogo-engineering-reference-2_12_15.md`. The structure in brief:

- Root denies all read/write by default.
- `roles/hosts/{uid}`: a user can read only their own host flag; no client writes (console-managed).
- `users/{uid}`: each user reads/writes only their own subtree (covers trainerName, linkedClientIds, activity).
- `cd:codes/{codeId}`: publicly claimable via a constrained write rule that enforces single-claimer semantics at the database level (checks `claimed == false` at write time, requires `claimedBy` to be a string, value unchanged, session not paused).
- `cd:session/claimedCount`: public +1-only increments when not paused.
- `cd:claims/{fp}`: parent host-only readable; individual child publicly readable and write-once.
- `gw:entrants/{id}`: public self-entry with shape validation; `won` must start false.
- Host-only paths (`cd:history`, `gw:history`, `gw:draws`, `stats:*`, `gw:templates`) currently gate on `auth != null`, meaning any signed-in user could technically read/write them. Acceptable because they are only referenced from host-only UI, but flagged for future hardening to a real role check.

Any new database path requires a matching rules update or it will silently fail with PERMISSION_DENIED in the diagnostics panel.

---

## Authentication and profile model

The app treats Google sign-in as a private account/profile layer, distinct from the public event identity.

**Private identity (Google sign-in):** Firebase Auth UID, Google display name, email, profile photo. Stored in `/users/{uid}`, used for profile/history features.

**Public event identity:** the trainer name (or a generated ticket number for anonymous giveaway entry). This is what the host announces and what appears in giveaway draws.

Rules of thumb baked into the UI:

- Never require the host to announce an email address.
- Never force a Google display name to become the public giveaway name.
- Trainer name is for host/community-facing interaction; Google UID/email is for private profile history and future passport/progress features.

Auth flow components and helpers:

- Google sign-in via `firebase.auth.GoogleAuthProvider()` and `signInWithPopup` (never redirect -- see gotchas).
- `AgeGate` (13+) shown once before first sign-in; persisted to localStorage and `/users/{uid}/ageConfirmed`.
- `TrainerNameChooser` (added v2.12.16) shown once after first sign-in when the profile has no trainer name; skippable, blank input, editable later.
- Guest mode with a dismissible warning banner that history/passport progress will not be saved.
- `CommunitySignInChooser` on the attendee home.
- `checkHostRole(uid)` with in-memory cache; `ensureCommunityProfile(user)`; `loadSavedProfileTrainerName(authUser)`; `rememberTrainerNameForProfile(authUser, name)`.
- Diagnostics show only for hosts or when the URL has `?debug=1`.

---

## Visual design system

Papercraft/cardstock aesthetic: rounded corners, pill buttons, soft layered shadows.

- **Fonts:** Fredoka (headings), Nunito (body).
- **Palette:** Primary Blue #1FA5DC, Secondary Green #7DC25C, Accent Orange #F08838, Paper #FFFCF2, Ink Navy #0D2D52.
- **Logo URLs:** mark only `https://ggpogo.com/wp-content/uploads/2026/05/cropped-logo-no-text.png`; full wordmark `https://ggpogo.com/wp-content/uploads/2026/05/logo-full.png`.
- **Icon discipline:** raw emoji used as UI icons render at platform-defined sizes that ignore surrounding font-size, ballooning on Windows/Edge. UI icons use the `Icon` SVG component (explicit width/height). Decorative emoji inside fixed-size containers must set `fontSize`, `lineHeight: 1`, and `overflow: hidden` to stay constrained. This recurs -- it was the cause of fixes in v2.2.7, v2.6.1, v2.12.8, and v2.12.20.

---

## Feature inventory (current state)

**Code Drop:** paste-to-add codes with duplicate detection and CSV mode (`code,expiresAt,reward`); sequential oldest-first non-expired code selection; per-code expiration with EXPIRED badges and bulk clear; reward labels per batch or per code; session start with QR code and 4-char anti-screenshot session code; concurrent-safe claim flow (transaction-guarded, handles 100-200 simultaneous claimers); live claimed/remaining counts; per-session claim limit; pause/resume; undo last claim; session history with date-range CSV export; session-specific "THIS SESSION" claimed count on the live screen (v2.12.18); newest-first "Recently claimed" list (v2.12.18).

**Giveaway/Raffle:** prize pool with four types (Generic, Code from the cd:codes pool, Physical, Special with host delivery confirmation); QR self-entry and manual host entry; entry-order `#N` badges; weighted bonus entries with +/- controls; slot-machine draw animation over the weighted pool; re-roll; atomic winner confirmation; winner reveal on the attendee's own device for code prizes; past-giveaway history with date-range CSV export.

**Community auth:** Google sign-in, age gate, trainer-name chooser, guest mode, role-based host dashboard, private profile with activity history.

**My Activity (v2.12.19):** signed-in users see their complete check-in history -- code claims (with the actual code, reward, and meetup name) and giveaway entries (with meetup name) -- merged into one timeline grouped by date, newest first.

**Meetup Stats:** host-only RSVP/check-in aggregation from Campfire via a Cloudflare Worker CORS proxy, with privacy-stripped caching (only `{id, rsvp_status}` per member) and trend snapshots.

**Campfire event association (v2.12.0):** sessions can link to the closest cached Campfire event within a 12-hour window; the event name carries through to history, CSV exports, and (since v2.12.19) the My Activity timeline.

**Branding:** custom logo and background image with graceful onError fallbacks.

**Diagnostics:** ErrorBoundary + CrashScreen, floating issues panel, global error/rejection capture. Host-gated.

**On-page version footer (v2.12.2):** low-opacity APP_VERSION tag, bottom-left, so the live version is confirmable without inspecting the file.

**Privacy policy links (v2.12.17):** in AgeGate, TrainerNameChooser, the QR sign-in card, and the AttendeeHome footer, all pointing to `/privacy-policy/`.

---

## Complete version history

### v1.0 to v2.0 -- initial build and Code Drop launch
Code Drop end-to-end: host login, paste-to-add with duplicate detection, session start with QR, attendee claim with device fingerprinting, code + redeem-link reveal, live counters, stash-empty state, pause/resume, end session with history and CSV export, undo-last-claim, low-stock warning, and the branding system.

### v2.2 -- data model refactor
`cd:codes` moved from a JS array to an object map to enable per-item security rules. `codesObjToArray`/`codesArrayToObj` introduced. `cd:sessionLog` converted to a push-key object for append-without-read-access.

### v2.2.1 -- CodeManage
Multi-select checkboxes, remove-selected, remove-all, per-code claimed toggle. Became the reference pattern for the Giveaway prize pool.

### v2.2.2 -- Babel parse fix
"Unexpected digit after hash token" from `c.purple + "1a"` inside a JSX ternary. Fixed by precomputing concatenated color+hex values before JSX. This pattern recurs.

### v2.2.3 -- session-resume fix
`CodeDropApp` screen state now derives from whether `cd:session` exists; guards `startSession()` against overwriting a live session.

### v2.2.4 -- critical claim-flow fix
The claim flow had been silently failing on every write since the v2.2 rules went live, while showing a success screen anyway. Two root causes: two separate `.set()` calls each failing the final-state rule check, and full-node overwrites of parents the rules don't grant. Fixed with atomic `FB.update()` to exact child paths and a "claimerror" stage.

### v2.2.5 -- hooks-order fix
Two `useState` calls placed after early returns violated the Rules of Hooks (blank page, no console errors). Moved all hooks to the top.

### v2.2.6 -- diagnostics system
Added ErrorBoundary, CrashScreen, DiagnosticsPanel, reportIssue/useDiagnostics, and global error/rejection listeners.

### v2.2.7 -- emoji button sizing
Introduced the `Icon` SVG component to replace emoji UI icons that ballooned on Windows/Edge.

### v2.3.0 -- Giveaway feature
Prize pool, QR self-entry, manual entry, slot-machine draw, atomic winner confirmation, history with CSV. Code Drop was field-confirmed; Giveaway was built but not yet field-tested.

### v2.5.0 -- prize types, anti-refresh, sequential/expiring codes
Four prize types; the one-code-per-device refresh exploit fixed (read `cd:claims/${fp}` directly); `order` and `expiresAt` on codes with oldest-first selection; CSV import; date-range history export.

### v2.5.1 -- concurrency hardening
`FB.transact` plus `claimCodeNode`, `registerClaim`, `incrementCounter`/`decrementCounter`. Fixed dropped increments, spurious loser-gets-error under load, undo-erasing-concurrent-claims, and an O(n) win-listener rescoped to per-entrant.

### v2.6.0 -- reward labels
Human-readable `reward` field on codes, per-batch or per-code, shown on reveal screens. CSV extended to `code,expiresAt,reward`.

### v2.6.1 -- transaction fix and emoji replacement
Fixed `claimCodeNode` aborting on Firebase's initial null-guess pass (every claim failing silently). Replaced remaining host-UI decorative emoji with SVGs; added image onError fallbacks to BrandingSettings.

### v2.7.0 -- Meetup Stats
Host-only RSVP/check-in aggregation from Campfire via Cloudflare Worker proxy, based on a 23-page API handoff. Privacy-stripped caching.

### v2.10.0 / v2.10.1 -- (blank page incident and the Babel pin)
A production blank page traced to an unpinned Babel Standalone CDN reference serving an automatic-runtime build. Fixed permanently by pinning `@7.29.7`, adding `data-presets="react"`, and the `/** @jsxRuntime classic */` pragma.

### v2.11.0 / v2.11.1 -- session-aware landing page
AttendeeHome now watches `cd:session`/`gw:session` and shows only tiles for running tools, or a community landing between events. v2.11.1 fixed tiles routing unauthenticated attendees through the host gate; they now navigate directly to the claim/join URL. This release also established the rule that every distinct delivery bumps the patch number even if the prior one was never deployed.

### v2.12.0 -- Campfire event association
`findClosestEvent` suggests the nearest cached event within 12 hours; `eventId`/`eventName` stored on the session, carried into history and CSV exports. Labeling only; cross-referencing attendance deferred to Phase 2.

### v2.12.1 -- fingerprint collision incident
Attendees on the same phone model were recognized as the same person. The deterministic hardware-trait hash was identifying phone model, not person. Rewritten to a random `crypto.randomUUID()` stored in `ggpogo_client_id_v1`, with a storage-availability fallback. Function name and return type unchanged so no call sites or rules needed edits.

### v2.12.2 -- on-page version footer
Low-opacity APP_VERSION tag, bottom-left. APP_VERSION must now be bumped to match the filename on every release -- a permanent checklist step.

### v2.12.3 -- bonus entries and entry-order numbers
`#N` order badges on the entrant list; weighted bonus entries via a new `extraEntries` field and `buildWeightedPool`.

### v2.12.4 / v2.12.5 -- UX improvements (with a blank-page fix)
v2.12.4 shipped a blank-page bug; v2.12.5 fixed it and carried the improvements: bonus minus button, inline confirm dialogs replacing native `confirm()`, Start button promoted above collapsible setup panels, downplayed Skip buttons, session-code explanations to attendees, live entrant count on the waiting screen, last-session summaries on dashboard cards.

### v2.12.6 / v2.12.7 -- mobile date-input fixes
`box-sizing: border-box` and `min-width: 0`, then a full fix with `-webkit-appearance: none` on date inputs and a narrow-screen stacking class for paired From/To rows.

### v2.12.8 -- host login emoji fix
Replaced the oversized lock emoji on the host login screen with the logo mark.

### v2.12.9 to v2.12.12 -- community auth foundation
Google sign-in, age gate, guest mode and banner, sign-in chooser, `/users/{uid}` profiles, `/roles/hosts/{uid}` lookup, `checkHostRole`, `ensureCommunityProfile`, initial UUID-to-UID migration. Removed the old email/password HostLogin. Worked through a sequence of bugs: components nested inside StatusPill from a bad insertion, orphaned function bodies, `signInWithRedirect` failing without Firebase Hosting (switched to `signInWithPopup`), and rules blocking the new paths.

### v2.12.13 -- optional Google sign-in inside QR flows (Nyx/ChatGPT)
`OptionalProfileSignInCard`; auth props threaded into CodeClaim/GiveawayClaim; URL parsing split from auth listening; age gate moved ahead of QR routing; `uid`/`entryMode` on log and entrant records; activity writes under `/users/{uid}/activity/`; risky JSX `&&` routing replaced with precomputed `show*` booleans.

### v2.12.14 -- QR-flow polish and privacy-conscious copy (Nyx/ChatGPT)
Trimmed QR copy; reframed sign-in as a private profile; renamed to "Public trainer name"; signed-in users can claim Code Drop without a public name; ticket-number option for anonymous giveaway entry; no email shown in QR flow; compact privacy-policy link; `loadSavedProfileTrainerName`; client-ID linking moved to `/users/{uid}/linkedClientIds/`; diagnostics host-gated.

### v2.12.15 -- Firebase US-region migration
New project `ggpogo-tools-us` in us-central1 to cut ~150-200ms Belgium latency to ~40-50ms. Full JSON export/import, re-established Google sign-in, rules, and host role. Config updated; no code-logic changes. Old `ggpogo-tools` retained dormant as backup. Note: Firebase Auth UIDs are project-scoped, so all UIDs reset (practical impact zero, since only the admin had signed in).

### v2.12.16 -- trainer name chooser
`TrainerNameChooser` overlay shown once after first sign-in when the profile has no trainer name. Skippable per session, blank input, editable later. Saves to `/users/{uid}/trainerName` and `ggpogo_trainer_name`. Render order: age gate, QR routes, auth loading, then the chooser, then home -- so QR claim flows are never interrupted. This delivery also folded in the v2.12.15 US config (the prior working source predated it).

### v2.12.17 -- privacy policy links
Added `/privacy-policy/` links to AgeGate, TrainerNameChooser, and the AttendeeHome footer, joining the existing QR-card link (four total).

### v2.12.18 -- claim sort order and session-specific count
Added `claimedAt` timestamps to claims (written on claim, cleared on undo/unclaim, set on manual mark), parsed and persisted in the code helpers. "Recently claimed" now sorts newest-first. The live screen's claimed tile shows the session-specific count labeled "THIS SESSION"; the splash page keeps the all-time total.

### v2.12.19 -- check-in history (My Activity)
`ActivityHistory` view reading `/users/{uid}/activity/codeClaims` and `giveawayEntries`, merged and grouped by date, newest first. Code entries show the code, reward, and meetup name; giveaway entries show the meetup name. A "My Activity" button appears on AttendeeHome for signed-in users. Both `recordProfileActivity` calls now include `eventName` from the session, so future records show the meetup.

### v2.12.20 -- activity emoji sizing
Constrained the My Activity emoji icons (empty-state and timeline rows) with reduced font sizes, `lineHeight: 1`, and `overflow: hidden`, matching the project's icon discipline.

---

## Key technical gotchas

A consolidated list. These recur and are easy to reintroduce.

1. **Babel pin + classic pragma are mandatory.** Unpinned CDN serves automatic-runtime builds that blank the page before React mounts. Verify the literal script tag, not a local parse.
2. **WordPress corrupts `&&`.** JSX logical `&&` (even inside comments) can be re-serialized to `&#038;&#038;`, breaking the parse. Avoid `&&` in JSX expression positions; compute booleans first. Use ternaries (`cond ? x : null`) in render.
3. **No native `confirm()`.** Blocked/unreliable in WordPress embeds. Use the `ConfirmModal` component + `useConfirm` hook.
4. **No components defined inside hooks or other functions.** Causes blank-page Babel parse errors.
5. **`signInWithPopup`, never redirect.** Redirect needs the Firebase Hosting auth handler page; without Hosting deployed, `init.json` 404s and sign-in silently fails.
6. **Firebase Realtime Database region is permanent.** Changing region means a new project and a data migration.
7. **Firebase Auth UIDs are project-scoped.** A new project resets every UID; all UID-keyed data must be re-established.
8. **Color+hex concatenation inside JSX.** `someColor + "1a"` can misparse. Precompute before the JSX expression.
9. **All hooks at the top.** Hooks after early returns blank the page with no console errors.
10. **`cd:claims` parent vs child read.** Attendees must read `cd:claims/${fp}` directly; reading the host-only parent returns null and silently bypasses the already-claimed check.
11. **Rules must be updated alongside any new database path**, or it silently fails with PERMISSION_DENIED.
12. **`str_replace` near function boundaries.** After any edit touching a function boundary, grep the function name and verify its braces are balanced and correctly scoped.
13. **Emoji in fixed-size containers** need `fontSize`, `lineHeight: 1`, and `overflow: hidden`, or they balloon on Windows/Edge.
14. **APP_VERSION is manual.** Nothing derives it; bump it to match the filename on every delivery.

---

## Pre-delivery checklist

Run before every file delivery:

```text
[ ] File name and APP_VERSION match and are incremented from the previous delivery.
[ ] Firebase config points to ggpogo-tools-us (us-central1), not the old europe-west1 project.
[ ] Babel is pinned to @7.29.7.
[ ] Classic JSX runtime pragma is present as the first line inside the script.
[ ] No import/export statements.
[ ] No native confirm() calls.
[ ] No encoded &#038; artifacts.
[ ] No JSX && expressions in expression positions.
[ ] Any new React component is a top-level named function.
[ ] Brace balance verified in the script block.
[ ] Local Babel/JSX parse check passes (necessary but not sufficient for the pin issue).
[ ] WordPress paste smoke test passes.
[ ] Host role check works (signed-in host sees Event Day Dashboard).
[ ] Direct Code Drop QR flow works as guest and when signed in.
[ ] Direct Giveaway QR flow works as guest/ticket number and when signed in.
[ ] No attendee diagnostics unless host or ?debug=1.
[ ] Privacy Policy link target exists or is intentionally pending.
[ ] Firebase rules support any new DB paths.
```

---

## Firebase configuration reference

Current production config (`ggpogo-tools-us`):

```js
{
  apiKey: "AIzaSyAfReMKn_RFOxUhtpoqN_dKhavyuCzSgWE",
  authDomain: "ggpogo-tools-us.firebaseapp.com",
  databaseURL: "https://ggpogo-tools-us-default-rtdb.firebaseio.com",
  projectId: "ggpogo-tools-us",
  storageBucket: "ggpogo-tools-us.firebasestorage.app",
  messagingSenderId: "1075593279660",
  appId: "1:1075593279660:web:eed79b8025fb6b9143c709"
}
```

Old project config (`ggpogo-tools`, europe-west1, dormant backup):

```js
{
  apiKey: "AIzaSyDtnqBfQWIbAFUd4cIJbrhwcQrEw1LzJbU",
  authDomain: "ggpogo-tools.firebaseapp.com",
  databaseURL: "https://ggpogo-tools-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ggpogo-tools",
  storageBucket: "ggpogo-tools.firebasestorage.app",
  messagingSenderId: "1029277084624",
  appId: "1:1029277084624:web:e0591c7dbabc80467be7d5"
}
```

Consoles:

```text
Firebase Console:     firebase.google.com  ->  ggpogo-tools-us
OAuth consent screen: console.cloud.google.com/auth/branding?project=ggpogo-tools-us
```

The Cloudflare Worker CORS proxy source is `campfire-cors-proxy-worker.js`; redeploy there if the Worker URL changes.

---

## Host role management

Host roles are managed manually in the Firebase Console. There is no in-app role UI.

To add a host:

1. The person signs in with Google on the Event Tools page.
2. Firebase Console, select `ggpogo-tools-us`, then Authentication, then Users.
3. Find the account and copy the User UID.
4. Realtime Database, Data tab.
5. Navigate to or create `/roles/hosts/{uid}` and set the value to `true`.
6. The person reloads and sees the Event Day Dashboard.

To remove a host: delete the `/roles/hosts/{uid}` node; the person reloads to the attendee view.

Current hosts: Eric's new-project UID is set (check `/roles/hosts/` for the value). Daniel (Ironbear1777) is not yet added -- he needs to sign in once, then his UID gets the flag.

If the Firebase Console data viewer is stuck in "Read-only and non-realtime mode" (hides the + button), click any child node like `cd:codes` to enter realtime mode, then breadcrumb back to root.

---

## Google OAuth consent screen

Configured on `ggpogo-tools-us` in the Google Cloud Console (not Firebase). Branding page:

```text
console.cloud.google.com/auth/branding?project=ggpogo-tools-us
```

Set: App name, user support email (gardengrovepogo@gmail.com), application home page (https://ggpogo.com/), application privacy policy link (https://ggpogo.com/privacy-policy/), and `ggpogo.com` added to Authorized domains (alongside the Firebase domain).

Branding verification is optional and not required while the app's publishing status is Testing. The only effect of skipping it is that some users may see a one-time "this app isn't verified" notice during sign-in, which is harmless. If verification is ever pursued, the app name on the consent screen must match the name on the homepage.

---

## Deployment and cache clearing

Updates are pasted into the WordPress Custom HTML block at ggpogo.com/event-tools/ and saved with Update.

If a newly pasted version does not appear on the live page (the version footer still shows the old number), clear caches in order:

1. **SiteGround:** WordPress admin, SG Optimizer (or the Purge Cache button in the admin bar), Purge Cache. A per-page purge is available from the admin bar while viewing the page.
2. **Cloudflare:** dash.cloudflare.com, select ggpogo.com, Caching, Configuration, Purge Everything (or Custom Purge for the single URL).

Then hard-refresh (Ctrl+Shift+R) or use incognito. The footer should show the new version.

---

## Open items

### Near-term

1. Profile/settings page where the trainer name can be edited after initial setup.
2. Add Daniel's host role once he signs in (`/roles/hosts/{his uid}: true`).
3. Field-test the v2.12.16 to v2.12.20 batch across a few meetups, then a second-pass UX review.
4. Consider tightening host-only database rules to a real role check rather than `auth != null`.

### Product / feature backlog

1. Badge/passport system: award stickers/badges for check-ins, viewable in a passport book.
2. Multi-host role management UI.
3. Optional high-value giveaway entry-token mode (friction appropriate for big prizes only).
4. Giveaway prize-type expansion: winner notification on the attendee device for more types, pending-delivery state for Special prizes.
5. QR code shareable link / tap-to-copy action.
6. Public sponsor/city-hall stats dashboard (no-login, curated metrics, charting).
7. Event metadata/categorization (Community Day, Raid Hour, etc.).
8. CORS proxy redundancy (currently a single Worker on one account; manual-paste fallback always works).
9. Phase 2 Campfire event association: cross-reference distribution/raffle data against actual check-in attendance.
10. Firebase Anonymous Auth migration for attendee identity (lets rules validate a real `auth.uid`; deferred due to Spark-plan cleanup concerns).
11. GitHub repository organization (deferred to a dedicated chat).
12. Vite + Firebase Hosting migration once the paste workflow becomes the real bottleneck.
13. Delete the old `ggpogo-tools` project once the new one is confirmed stable.

### WordPress site (separate workstream)

Homepage hero text centering, feature cards and green CTA section completion, Resources page card styling, About page whitespace/photo fixes, footer redesign, and password-protecting the /event-tools/ page.

---

## Versioning convention

`X.Y.Z`:

- **Z (patch):** every distinct delivery -- bug fixes, small features, polish. Bumped on every file that leaves a session, even same-day fixes to a version never deployed live. This is the audit trail.
- **Y (minor):** a meaningful capability milestone, drawn when a cluster of patches closes a chapter and a new one begins (e.g. the next major feature push could open v2.13.0).
- **X (major):** a fundamental change to the app (the 1.x to 2.x jump was the full rebuild; a 3.0 might be a build pipeline or multi-file architecture).

In practice: keep incrementing Z per delivery; bump Y when a chapter closes.

---

## Quick-start for a new session

Context order:

1. This document.
2. `wordpress-block-v2_12_20.html` -- current production file; start edits from here.
3. The prior handoff chain for deeper per-session detail, if needed.
4. Current Firebase rules (published on ggpogo-tools-us; full JSON in the 2.12.15 handoff).
5. `campfire-cors-proxy-worker.js` only if the Worker needs redeploying.

The pre-delivery checklist applies to every edit, no exceptions. The Babel pin, classic pragma, and `&&`/`&#038;` checks are not optional, and any rules change must be called out explicitly in the delivery message.
