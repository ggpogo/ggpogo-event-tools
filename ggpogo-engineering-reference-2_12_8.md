# Garden Grove PoGo Event Tools
## Engineering Handoff — v2.12.3 through v2.12.8
### June 2026

This document covers all work completed in the conversation that began with v2.12.2 as the production baseline and ended with v2.12.8 as the delivered file. It is intended to be read alongside the previous reference document (`ggpogo-engineering-reference-2_12_2.md`), which covers the full architecture, Firebase data model, security rules, component map, and everything up through v2.12.2. This document does not repeat that foundational material — it only records what changed, what was added, and what was learned.

---

## Table of Contents

1. [Session summary](#session-summary)
2. [Version history (this session)](#version-history-this-session)
3. [Feature: bonus entries for giveaway](#feature-bonus-entries-for-giveaway)
4. [Feature: entry order numbers](#feature-entry-order-numbers)
5. [UX improvements (v2.12.4 through v2.12.5)](#ux-improvements)
6. [Bug fixes (v2.12.5 through v2.12.8)](#bug-fixes)
7. [New technical gotchas discovered this session](#new-technical-gotchas-discovered-this-session)
8. [Firebase data model changes](#firebase-data-model-changes)
9. [Component changes](#component-changes)
10. [File reference](#file-reference)
11. [Open items](#open-items)
12. [Quick-start for a new session](#quick-start-for-a-new-session)

---

## Session summary

This session started with a field-test request for v2.12.3 features (bonus entries + entry order numbers), then expanded into a structured UX review covering all three user perspectives: developer, host, and attendee. Seven UX improvements were identified, approved, and implemented together as v2.12.4/v2.12.5. Three separate bugs were then discovered and fixed (v2.12.5 blank page, v2.12.6/v2.12.7 mobile input overflow, v2.12.8 login screen icon). The production-ready file is `wordpress-block-v2_12_8.html`.

No Firebase security rules changes were made in this session. The rules file from v2.9.4 remains current.

---

## Version history (this session)

### v2.12.3
**Features added:**

Entry order numbers on the giveaway entrant list. Each entrant row in the host's live session view now displays a `#1`, `#2`, etc. badge. The sort key is `enteredAt` (already stored on every entrant node). Sorting happens at render time in the entrant list; the draw pool uses the unsorted `entrants` state array — these are intentionally decoupled (list order is cosmetic, draw pool order is irrelevant to randomness).

Bonus entries for giveaway entrants. The host can award additional entries to any non-winner entrant during a live session using a `+` button on each entrant row. A `+N bonus` pill appears when bonuses exist. The draw and re-roll functions use a weighted pool: each entrant occupies `1 + extraEntries` slots. When a winner is confirmed, they are removed from all future pools along with their bonus entries. A `-` button (added in v2.12.4, see below) allows correction of accidental additions.

**Firebase data model change:** a new optional `extraEntries` field (numeric, default 0) was added to each entrant node under `gw:entrants`. The `entrantsObjToArray` helper was updated to read it with a safe fallback: `typeof v.extraEntries === "number" ? v.extraEntries : 0`. No rules change required — the field writes through the existing host-authenticated write path.

**New helper function added:** `buildWeightedPool(source)` — takes an array of entrant objects and returns a new array where each entrant appears `1 + extraEntries` times. Used by both `draw()` and `reroll()`.

### v2.12.4
**Intended as the UX improvement release. Delivered but contained a blank-page bug — see v2.12.5.**

### v2.12.5
**Bug fix release.** Corrected the blank-page error introduced in v2.12.4. See "New technical gotchas" below for the full account. All v2.12.4 UX improvements are present in v2.12.5.

**UX improvements included (full detail in the Features section below):**

1. Bonus entry minus button
2. Inline confirm dialogs replacing all native `confirm()` calls
3. Start button promoted above setup panels; setup panels collapsible
4. Skip button downplayed on both Code Drop and Giveaway entry screens
5. Session code explained to attendees on waiting, won, and reveal screens
6. Live entrant count on the Giveaway "You're entered!" waiting screen
7. Last session summary on the Event Day Dashboard cards

### v2.12.6
**Bug fix.** Added `box-sizing: border-box` and `min-width: 0` to the global input CSS rule to address mobile date input overflow. Partially effective — the iOS-specific intrinsic width behavior was not yet fully resolved.

### v2.12.7
**Bug fix.** Fully resolved the mobile date input overflow that persisted after v2.12.6. Two-part fix: added `-webkit-appearance: none; appearance: none` to `input[type="date"]` in the global CSS (overrides iOS Safari's native date picker chrome which ignores width constraints), and introduced a `gg-date-row` CSS class with a `@media (max-width: 400px)` breakpoint that stacks the paired From/To inputs vertically on very narrow screens. Applied to all three paired date input rows: Code Drop Reward/Expires, Session History From/To, and MeetupStats Date Range From/To.

### v2.12.8
**Visual fix.** Replaced the oversized `🔒` emoji on the Host Login screen with the GGPoGo logo mark (`https://ggpogo.com/wp-content/uploads/2026/05/cropped-logo-no-text.png`) at 72×72px with `objectFit: contain`.

---

## Feature: bonus entries for giveaway

### What it does

During a live giveaway session, the host can award extra entries to any entrant who has not yet won. Use cases include: showing a specific Pokémon on request, following on Instagram, arriving early, etc. Each bonus entry increases that person's statistical odds of being drawn proportionally. A person with 2 bonus entries has 3 total slots in the weighted draw pool (1 base + 2 bonus).

### Host UI

On each non-winner row in the entrant list (host live session view only — not visible to attendees):

- A yellow `+` button adds one bonus entry. Tap it multiple times to award multiple.
- A grey `-` button appears whenever `extraEntries > 0`. Tapping it decrements by one, floored at zero. When back to zero the `-` button disappears and the bonus pill disappears.
- A `+N bonus` amber pill shows the current bonus count when non-zero.
- The `×` remove button to delete the entrant entirely is still present alongside these controls.

### Draw mechanics

`buildWeightedPool(source)` is called by both `draw()` and `reroll()`. It iterates the eligible entrant array and pushes each entrant object `1 + (e.extraEntries || 0)` times. The slot-machine animation also cycles through this weighted pool, so an entrant with bonuses appears proportionally more often during the spin visually as well as statistically.

When a winner is confirmed via `confirmWinner()`, the entrant is marked `won: true` in Firebase. The `eligible` array used by the draw is derived as `entrants.filter(e => !e.won)`, so the winner — along with all their bonus entries — is automatically excluded from all future draws in the session.

### Firebase storage

`extraEntries` is stored directly on the entrant node: `gw:entrants/{entrantId}/extraEntries`. It is written by the host via `FB.set(`gw:entrants/${e.id}/extraEntries`, next)`. No schema migration is needed for existing entrant nodes — the `entrantsObjToArray` helper defaults to 0 if the field is absent.

---

## Feature: entry order numbers

Each entrant row in the host live session view shows a `#N` badge indicating the order in which that person entered the raffle. Implemented by sorting the entrants array by `enteredAt` timestamp at render time before mapping to rows, then using the array index + 1 as the display number. The sort does not affect the draw pool — `eligible` is derived from the unsorted `entrants` state.

---

## UX improvements

All implemented in v2.12.5.

### 1. Bonus entry minus button

See the bonus entries feature section above.

### 2. Inline confirm dialogs

All 11 native `confirm()` dialog calls across the app have been replaced with an in-UI two-step confirmation pattern.

**Implementation:** A `ConfirmModal` component is defined as a stable top-level named function (important — see the gotchas section). A `useConfirm()` hook manages the state and handlers. Each component that needs confirmations calls `useConfirm()` and renders `<ConfirmModal>` in its return tree.

```javascript
// The hook
function useConfirm() {
  const [confirmState, setConfirmState] = useState(null);
  const requestConfirm = (message, onConfirm) => setConfirmState({ message, onConfirm });
  const handleCancel = () => setConfirmState(null);
  const handleConfirm = () => {
    if (confirmState) confirmState.onConfirm();
    setConfirmState(null);
  };
  return { confirmState, requestConfirm, handleCancel, handleConfirm };
}

// Usage in a component
const { confirmState, requestConfirm, handleCancel, handleConfirm } = useConfirm();

// Trigger
const remove = (id) => {
  requestConfirm("Delete this code permanently?", async () => {
    await FB.remove(`cd:codes/${id}`);
  });
};

// Render (inside the component's return)
<ConfirmModal confirmState={confirmState} onCancel={handleCancel} onConfirm={handleConfirm} />
```

`ConfirmModal` renders a fixed-position overlay with a centered card, the message text, a Cancel button, and a red Confirm button. It returns `null` when `confirmState` is null. Components that use it: `CodeManage`, `BrandingSettings`, `MeetupStatsApp`, `GiveawayApp`.

**Critical pattern note:** `ConfirmModal` must be defined as a top-level named function outside any hook. Defining it inline inside the hook's return value (as was done in the failed v2.12.4 build) causes React to see a new component type on every render, triggering constant unmount/remount and a blank-page failure in Babel Standalone. See the gotchas section.

### 3. Start button promoted, setup panels collapsible

On both `CodeDropApp` and `GiveawayApp` dashboards, the layout was restructured so that the action (start/resume) appears above the setup forms.

**Code Drop:** The Campfire event picker and START NEW SESSION button now appear directly below the stat cards and quick links. The Add Codes and Session Settings panels are inside a toggled accordion (default collapsed). A `showSetup` boolean state variable controls the accordion. When codes are already loaded, the host sees the start button immediately without scrolling past setup UI.

**Giveaway:** The Prize Pool list remains always visible (it is status information, not setup). The Campfire event picker and START GIVEAWAY button appear immediately below the prize pool. The Add Prize form is inside a toggled accordion (default collapsed).

Both accordions use a plain `<button>` with an arrow indicator (▲/▼) and toggle `showSetup` state. The accordion button uses the `gg-date-row`-style inline CSS rather than a Paper card to keep it visually subordinate.

### 4. Skip button downplayed

On both the Code Drop claim screen (`CodeClaim`) and the Giveaway entry screen (`GiveawayClaim`), the "Skip — claim/enter anonymously" action was previously rendered as a full-width `StickerBtn` nearly as prominent as the primary action button. It is now a plain underline text link (`<button>` with `background: none`, `text-decoration: underline`, muted color). The explanatory note about what skipping does appears above it. The primary Enter/Claim button is visually unambiguous as the intended action.

### 5. Session code explained

The `SESSION / XXXX` pill that appears on attendee screens previously showed a cryptic 4-character code with no explanation. Text has been added to all three screens where it appears:

- **Code Drop reveal screen:** "If the host asks to verify your claim, show them this code — it confirms you're from today's live session."
- **Giveaway waiting screen:** "If the host needs to verify your entry, they'll ask you to show this code — it confirms you're part of today's live session."
- **Giveaway won screen:** "If the host asks to verify your entry, show them this code — it confirms you're part of today's live session before handing over your prize."

### 6. Live entrant count on waiting screen

The `GiveawayClaim` component now shows a live count of how many trainers are in the pool while the attendee waits. A new `useEffect` watches `gw:entrants` while `stage === "entered"` and updates `entrantCount` state. The display reads "47 trainers in the pool" or "You're the first one in!" for the first entrant. The watcher uses a full `gw:entrants` listener (not just a count path) since Firebase Realtime Database does not support count-only queries natively, but at event scale (100-200 attendees) this is acceptable on the free Spark plan.

### 7. Last session summary on Event Day Dashboard

Both the Code Drop and Giveaway cards on the `EventDayDashboard` now show a one-line summary of the most recent completed session when idle. Two new state variables (`lastCdSession`, `lastGwSession`) are populated by watchers on `cd:history` and `gw:history` respectively, sorting by `startedAt` descending and taking the first entry.

Displays:
- Code Drop idle: "Last session: 47 codes claimed · Jun 15"
- Giveaway idle: "Last session: 3 prizes drawn · Jun 15"

The summary is hidden when a session is active and absent if no history exists yet.

---

## Bug fixes

### Blank page bug (v2.12.4 → v2.12.5): component defined inside hook

**Symptom:** Complete blank page on load after deploying v2.12.4. No Babel parse error in the console — app mounted and immediately failed to render.

**Root cause:** The initial `useConfirm` implementation defined `ConfirmUI` as a component inside the hook's return value, conditionally: `const ConfirmUI = confirmState ? ({ c }) => (...JSX...) : () => null`. React treats a component's identity by reference. Because `ConfirmUI` was recreated as a new function on every render of the parent component, React saw a different component type each time and unmounted/remounted the entire subtree on every state change. In Babel Standalone's runtime environment this caused an immediate fatal render failure.

**Fix:** `ConfirmModal` was extracted as a stable top-level named function defined once outside any hook. The hook returns only primitive state and plain handler functions. The component renders `null` when `confirmState` is null. This is the correct React pattern regardless of environment — it was a fundamental mistake, not a Babel-specific quirk.

**Rule to carry forward:** Never define a React component (a function that returns JSX) inside a hook's body or return value. Components must always be stable top-level named functions.

### WordPress `&&` corruption (v2.12.4 → v2.12.5)

**Symptom:** Babel parse error on load: `Unexpected digit after hash token` at a line containing `&#038;&#038;`.

**Root cause:** Two `&&` operators introduced in v2.12.4 inside JSX attribute position were corrupted to `&#038;&#038;` by WordPress when the Custom HTML block was saved. This is the same known issue documented in the previous reference (§9.3), but was not caught before delivery because the pre-deployment `&&` grep check was not run.

**Specific location:** `lastGwSession && !gwActive` appeared twice in JSX attribute and conditional positions in `EventDayDashboard`.

**Fix:** Extracted to a plain JS variable before the return statement: `const showLastGw = !!lastGwSession ? !gwActive : false;`. Both JSX references replaced with `showLastGw`.

**Rule to carry forward:** The `&&` grep check from §9.1 of the previous reference is mandatory before every delivery. Any `&&` in a JSX expression position (attribute value or conditional render) must be extracted to a pre-computed variable. The only safe location for `&&` is inside plain JS `if` statements in function bodies.

### Mobile date input overflow (v2.12.6 → v2.12.7)

**Symptom:** On iOS Safari (and Chrome mobile emulation at narrow widths), `input[type="date"]` elements inside flex containers extended beyond their parent card boundary, causing overlapping and overflow on the Meetup Stats date range, Code Drop Expires field, and Session History date range.

**Root cause:** iOS Safari's native date picker input has a hardcoded minimum intrinsic width driven by the date picker chrome UI. This overrides `width: 100%`, `min-width: 0`, and `box-sizing: border-box` because the native appearance itself sets the size floor. The existing global `width: 100%` rule was having no effect.

**Fix (v2.12.7, two parts):**

1. Added `input[type="date"] { -webkit-appearance: none; appearance: none; max-width: 100%; }` to the global CSS block. Removing the native appearance lets the element respect its container's width.

2. Introduced a `gg-date-row` CSS class for all three paired date rows. The class sets `display: flex; gap: 8px` with `flex: 1; min-width: 0; overflow: hidden` on children, plus a `@media (max-width: 400px)` breakpoint that switches to `flex-direction: column` on very narrow screens. All three rows use `className="gg-date-row"` instead of inline flex styles.

**Note on v2.12.6:** The first fix attempt added `box-sizing: border-box` and `min-width: 0` to the global input rule. These were already partially covered by the `* { box-sizing: border-box }` universal selector. The iOS intrinsic width behavior requires `appearance: none` to override — CSS box model properties alone cannot override the native date picker's size floor.

### Login screen icon (v2.12.8)

**Symptom:** The `🔒` emoji on the Host Login screen rendered at an unexpectedly large size on mobile, particularly on iOS where emoji rendering is device-dependent.

**Fix:** Replaced the emoji div with an `<img>` tag loading the GGPoGo logo mark from `https://ggpogo.com/wp-content/uploads/2026/05/cropped-logo-no-text.png` at 72×72px with `objectFit: contain`.

---

## New technical gotchas discovered this session

### 1. Never define React components inside hooks

Described fully in the bug fix section above. The short version: any function that returns JSX and is intended to be used as a React component must be defined as a stable top-level named function. Defining it inside a hook, inside another component's render function, or as a conditional expression causes React to see a new component type on every render, which causes subtree remount failures in Babel Standalone.

### 2. WordPress && corruption applies to all JSX expression positions

The previous reference documented this for JSX attribute strings and certain conditional patterns. This session confirmed it also applies to any `&&` in a JSX conditional render position (`{a && b ? ...}`) and JSX attribute value expressions (`style={{ marginBottom: x && y ? a : b }}`). The safe pattern is to compute any expression involving `&&` as a named variable before the return statement.

### 3. iOS Safari date input intrinsic width ignores CSS box model

`input[type="date"]` on iOS Safari has a hardcoded minimum width from the native date picker chrome that overrides `width`, `min-width`, and `box-sizing`. The only reliable fix is `-webkit-appearance: none; appearance: none`, which removes the native chrome and lets the input render as a standard text-like input that respects CSS constraints. This changes the visual appearance of the date picker slightly on iOS (it uses the system keyboard date input rather than the native spinner), which is acceptable given the alternative is broken layout.

---

## Firebase data model changes

One change from v2.12.2:

**`gw:entrants/{entrantId}/extraEntries`** — new optional numeric field. Stores the number of bonus entries awarded to this entrant by the host. Defaults to 0 if absent (safe via the `entrantsObjToArray` helper). Written by the host during a live session via a direct `FB.set` call. Not written by the attendee entry flow. Not reset between draws — a winner's `extraEntries` is irrelevant after `won: true` is set, since they are excluded from all future eligible pools.

No other data model changes. No Firebase rules changes.

---

## Component changes

Summary of which components changed and why. Refer to the previous reference for the full component map.

| Component | Changed | Reason |
|-----------|---------|--------|
| `GiveawaySession` | Yes | Entrant order badges, +/- bonus buttons, bonus pill, `buildWeightedPool` for draw and reroll |
| `GiveawayApp` | Yes | `showSetup` accordion, Start button promotion, inline confirm dialogs (`GwConfirmUI` → `ConfirmModal`), `showLastGw` variable |
| `EventDayDashboard` | Yes | `lastCdSession`/`lastGwSession` watchers, last session summary display, `showLastGw` computed variable |
| `CodeDropApp` | Yes | `showSetup` accordion, Start button promotion |
| `CodeManage` | Yes | Inline confirm dialogs |
| `BrandingSettings` | Yes | Inline confirm dialogs, logo mark on login screen |
| `CodeClaim` | Yes | Skip button downplayed, session code explanation |
| `GiveawayClaim` | Yes | Skip button downplayed, session code explanation, live entrant count watcher and display |
| `CodeDropSession` | Yes | Session code explanation text updated |
| `MeetupStatsApp` | Yes | Inline confirm dialogs, `gg-date-row` on date range row |
| `SessionHistory` | Yes | `gg-date-row` on export date range row |
| `HostLogin` | Yes | Lock emoji replaced with logo mark |
| `entrantsObjToArray` | Yes | Added `extraEntries` field with safe fallback |
| `ConfirmModal` | New | Top-level stable component for inline confirmations |
| `useConfirm` | New | Hook returning `confirmState`, `requestConfirm`, `handleCancel`, `handleConfirm` |
| `buildWeightedPool` | New | Utility function inside `GiveawaySession` for weighted draw pool construction |

---

## File reference

| File | Purpose |
|------|---------|
| `wordpress-block-v2_12_8.html` | Current production file — paste into WordPress Custom HTML block |
| `firebase-database-rules-v2_9_4.json` | Current security rules — unchanged since v2.9.4, still accurate for v2.12.8 |
| `campfire-cors-proxy-worker.js` | Cloudflare Worker source — unchanged |
| `ggpogo-engineering-reference-2_12_2.md` | Previous full reference — covers architecture, data model, rules, component map through v2.12.2 |
| `ggpogo-engineering-reference-2_12_8.md` | This document — covers v2.12.3 through v2.12.8 |

---

## Open items

Carried forward from the previous reference, status unchanged:

1. QR code shareable link (tap to copy URL, separate from the QR image)
2. Public sponsor/city-hall stats dashboard
3. Multiple host roles
4. Event metadata/categorization
5. CORS proxy redundancy
6. Phase 2 Campfire event association (cross-referencing distribution data against check-in data)
7. Firebase Anonymous Auth migration
8. Event entry tokens as an optional per-session mode for high-value raffles
9. GitHub repository organization
10. Vite + Firebase Hosting migration (deferred until manual paste workflow becomes the bottleneck)

New items from this session:

11. **Login/authentication options review** — explicitly deferred by the operator to a future session. The current single-account email/password approach works but has no self-service password reset flow visible to the host, and no support for a second host account (Daniel). Investigation of options was deferred to after the v2.12.x UX work was complete.

12. **Full UX audit implementation** — the structured review in this session produced a prioritized list of 7 items, all of which were implemented. A second-pass UX review was suggested for a future session once field testing of v2.12.8 is complete.

---

## Quick-start for a new session

The minimum context a new session needs:

1. `ggpogo-engineering-reference-2_12_2.md` — full architecture reference, data model, security rules, component map, key gotchas through v2.12.2.
2. `ggpogo-engineering-reference-2_12_8.md` (this document) — all changes from v2.12.3 through v2.12.8.
3. `wordpress-block-v2_12_8.html` — current production file, start any new edits from this.
4. `firebase-database-rules-v2_9_4.json` — current rules, diff against this for any rules changes.

The mandatory pre-delivery checklist from §9.1 of the previous reference applies to every edit, with two additions from this session:

- The `&&` grep check must pass — no `&&` in JSX expression positions. Compute as named variables before return.
- Any new React component must be a stable top-level named function — never defined inside a hook or another component's render function body.
- All other checks from the previous reference remain in force: Babel CDN pin (`@7.29.7`), `/** @jsxRuntime classic */` pragma, `APP_VERSION` matches filename, no `confirm()` calls (replaced by `ConfirmModal` pattern), Firebase rules diff.

The next planned work (suggested starting point for the next session):

- Field test v2.12.8 and collect any remaining UX issues.
- Investigate login/authentication options (item 11 above).
- Begin planning the next major feature addition (giveaway or Code Drop expansion, TBD).
