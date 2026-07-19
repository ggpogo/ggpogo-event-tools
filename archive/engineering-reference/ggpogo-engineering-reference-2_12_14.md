# Garden Grove PoGo Event Tools
## Engineering Handoff — v2.12.9 through v2.12.14
### June 2026
 
This document continues the Garden Grove PoGo Event Tools engineering history after `ggpogo-engineering-reference-2_12_8.md`. It focuses on the authentication/profile work, direct QR-flow improvements, privacy-conscious display-name handling, and the v2.12.14 attendee-facing polish pass.
 
It should be read alongside:
 
- `ggpogo-engineering-reference-2_12_2.md` — full architecture, Firebase data model, rules, component map, and gotchas through v2.12.2.
- `ggpogo-engineering-reference-2_12_8.md` — bonus entries, entry order numbers, inline confirms, mobile date input fixes, and UX improvements through v2.12.8.
- `wordpress-block-v2_12_14.html` — current delivered HTML block.
- `roles-import.json` — current host-role import file.
---
 
## Table of Contents
 
1. [Current status](#current-status)
2. [Version history](#version-history)
3. [Authentication and profile model](#authentication-and-profile-model)
4. [Direct QR flow changes](#direct-qr-flow-changes)
5. [Public trainer name vs Google identity](#public-trainer-name-vs-google-identity)
6. [Code Drop changes](#code-drop-changes)
7. [Giveaway changes](#giveaway-changes)
8. [Diagnostics and field-debug behavior](#diagnostics-and-field-debug-behavior)
9. [Firebase data model additions](#firebase-data-model-additions)
10. [Security rules / permissions notes](#security-rules--permissions-notes)
11. [Privacy implications](#privacy-implications)
12. [Technical gotchas carried forward](#technical-gotchas-carried-forward)
13. [Pre-delivery checklist](#pre-delivery-checklist)
14. [Open items](#open-items)
15. [Quick-start for next session](#quick-start-for-next-session)
---
 
## Current status
 
The current delivered app file is:
 
```text
wordpress-block-v2_12_14.html
APP_VERSION = "v2.12.14"
```
 
The app is still deployed as a self-contained WordPress Custom HTML block. It uses:
 
- React 18 UMD from CDN
- ReactDOM 18 UMD from CDN
- Babel Standalone pinned to `@7.29.7`
- Firebase compat SDK `10.13.2`
- `type="text/babel" data-presets="react"`
- `/** @jsxRuntime classic */`
The paste-HTML workflow remains the production deployment method, but GitHub/versioned files should remain the source of truth. Do not edit the live WordPress block directly except for emergency rollback/paste operations.
 
The current host role import file contains one known host UID:
 
```json
{
  "hosts": {
    "yF2TJjk9jZf16kNwr2MGvWNbk9E3": true
  }
}
```
 
---
 
## Version history
 
### v2.12.8 baseline
 
v2.12.8 was the prior stable reference point. It included:
 
- Bonus entries for giveaway entrants.
- Entry order numbers in giveaway host view.
- Inline confirmation modal replacing native `confirm()`.
- Start/resume actions promoted above setup panels.
- Setup panels collapsed behind accordions.
- Skip buttons downplayed.
- Session-code explanation on attendee screens.
- Live entrant count on giveaway waiting screen.
- Last-session summary on the host Event Day Dashboard.
- iOS/mobile date input overflow fixes via `appearance: none` and `.gg-date-row`.
- Lock emoji replaced by GGPoGo logo mark on Host Login.
v2.12.8 explicitly documented two important hazards that remain mandatory checks:
 
- No `&&` expressions in JSX expression positions because WordPress may encode them into `&#038;&#038;`.
- No React components defined inside hooks or render bodies.
### v2.12.9 through v2.12.12 — community auth foundation
 
The app gained a community authentication layer separate from host-only functionality:
 
- Google sign-in using `firebase.auth.GoogleAuthProvider()`.
- Age confirmation gate before Google sign-in.
- Guest mode with local guest-name persistence.
- Guest banner explaining that meetup history/passport progress will not be saved.
- Community sign-in chooser on attendee home screen.
- Community profile creation/update at `/users/{uid}`.
- Host role lookup through `/roles/hosts/{uid}`.
- `checkHostRole(uid)` with in-memory role cache.
- `ensureCommunityProfile(user)` to store basic Google profile fields and timestamps.
- Initial `migrateUuidToUid(uid)` logic to link the existing browser client ID to an account.
Important: v2.12.12 introduced community auth, but direct QR claim/join routes still bypassed the sign-in UI. If a user scanned a Code Drop or Giveaway QR, they went straight to the public trainer-name screen and did not see the Google sign-in option.
 
### v2.12.13 — optional Google sign-in inside QR flows
 
v2.12.13 fixed the direct QR-flow gap.
 
Changes:
 
- Added top-level `OptionalProfileSignInCard` component.
- Passed `authUser`, `onGoogleSignIn`, `onSignOut`, `authBusy`, and `authError` into `CodeClaim` and `GiveawayClaim`.
- Split URL query parsing from Firebase auth listening so QR routes can still know whether a user is signed in.
- Moved the age gate ahead of QR routing so Google sign-in from QR pages can complete cleanly.
- Code Drop `sessionLog` entries now include `uid` and `entryMode` when signed in.
- Giveaway entrant records now include `uid` and `entryMode` when signed in.
- Added profile activity writes under `/users/{uid}/activity/codeClaims` and `/users/{uid}/activity/giveawayEntries`.
- Added `rememberTrainerNameForProfile(authUser, trainerName)`.
- Removed remaining risky JSX `&&` routing expressions by computing `showCodeDrop`, `showGiveaway`, `showBranding`, and `showStats` before JSX.
Field result: QR sign-in worked. However, the QR screens were too wordy, signed-in users were still blocked from Code Drop unless they entered a trainer name or clicked anonymous claim, and diagnostics were visible to normal attendees.
 
### v2.12.14 — QR-flow polish, privacy-conscious copy, diagnostics cleanup
 
v2.12.14 is the current delivered version and is reported as displaying and working as intended.
 
Changes:
 
- Reduced QR sign-in card copy.
- Reframed Google sign-in as private profile/history identity.
- Renamed `Trainer name` to `Public trainer name` on direct QR screens.
- Code Drop: signed-in users can claim without a public trainer name.
- Giveaway: users must still enter a public trainer name or use a generated ticket number.
- Giveaway anonymous option text changed to `Use a ticket number instead`.
- Code Drop signed-in no-name claim uses `Signed-in Trainer` internally rather than exposing an email or Google display name.
- Signed-in card no longer displays email address in the QR flow.
- Added compact `/privacy-policy/` link under the QR sign-in card.
- Added `loadSavedProfileTrainerName(authUser)` to prefill public trainer name from `/users/{uid}/trainerName`.
- Profile trainer names are saved back to `/users/{uid}/trainerName` when users provide one.
- Moved client-ID linking from global `/migrations/{clientId}` to `/users/{uid}/linkedClientIds/{safeClientId}`.
- Added `DiagnosticsPanel({ enabled })` and `shouldShowDiagnostics(isHost)`.
- Diagnostics now show only for hosts or when the URL includes `?debug=1`.
---
 
## Authentication and profile model
 
The app now treats Google sign-in as a private account/profile layer, not as the public event identity.
 
### Private identity
 
Google sign-in provides:
 
- Firebase Auth UID
- Google display name
- Google email
- Google profile photo URL
These are stored in `/users/{uid}` and used for account/profile/history features.
 
### Public event identity
 
The public-facing event identity is the `Public trainer name` or a generated ticket number.
 
Rules of thumb:
 
- Never require the host to announce an email address.
- Never force a Google display name to become the public giveaway name.
- Trainer name is for the host/community-facing event interaction.
- Google UID/email is for private profile history and future passport/progress features.
---
 
## Direct QR flow changes
 
Direct QR flows are the screens reached from:
 
```text
?cd_claim={sessionId}
?gw_join={sessionId}
```
 
Before v2.12.13, these routes bypassed auth state entirely and went straight to `CodeClaim` or `GiveawayClaim`.
 
Now:
 
1. URL query parsing sets `claimSession` / `joinSession`.
2. Firebase `onAuthStateChanged` always runs, even for QR routes.
3. QR claim/join components receive auth state and Google sign-in handlers.
4. Attendees see a compact optional sign-in card.
5. Guests can still continue.
6. Signed-in activity can be written to profile history.
The QR routes remain public and do not require sign-in.
 
---
 
## Public trainer name vs Google identity
 
This distinction is now a core UX/security/privacy principle.
 
### Google sign-in
 
Purpose:
 
- Save activity to profile.
- Enable future passport/progress features.
- Provide stable private account identity.
- Allow profile history for code claims and giveaway entries.
### Public trainer name
 
Purpose:
 
- What the host can safely call out.
- What appears in host giveaway entrant lists.
- What can be used to verify a prize/claim in person.
### Current behavior
 
Code Drop:
 
- Signed-out guest must enter a public trainer name or claim anonymously.
- Signed-in user may claim without entering public trainer name.
- If signed-in and no name is provided, claim display name becomes `Signed-in Trainer`.
- If a public trainer name is provided, it is saved locally and to `/users/{uid}/trainerName`.
Giveaway:
 
- Public trainer name remains the preferred path.
- If user does not want to provide a public trainer name, they can use a generated ticket number.
- This avoids announcing emails or real names.
- If signed-in and trainer name is provided, it is saved to profile.
---
 
## Code Drop changes
 
### QR claim screen
 
Copy was shortened:
 
- Heading: `Claim your code`
- Field label: `Public trainer name`
- Helper: `Optional if signed in. The host may use this to verify your claim.`
- Primary button: `Claim my code`
- Secondary link:
  - signed in: `Claim without public name`
  - signed out: `Claim anonymously`
### Claim logging
 
`cd:sessionLog` now stores additional context:
 
```js
{
  name,
  code,
  reward,
  time,
  fp,
  uid,
  entryMode
}
```
 
Where:
 
- `fp` is the random per-browser client ID.
- `uid` is Firebase Auth UID when signed in, otherwise `null`.
- `entryMode` is `signed_in` or `guest`.
### Profile activity
 
When signed in, Code Drop claims are also recorded under:
 
```text
/users/{uid}/activity/codeClaims/{generatedId}
```
 
Payload includes:
 
- `sessionId`
- `sessionCode`
- `codeId`
- `code`
- `reward`
- `displayName`
- `claimedAt`
- `recordedAt`
This is intended for future profile history and passport/progress features.
 
---
 
## Giveaway changes
 
### QR entry screen
 
Copy was shortened:
 
- Heading: `Enter the giveaway`
- Field label: `Public trainer name`
- Helper: `This is what the host will call out if you win.`
- Primary button: `Enter Giveaway`
- Secondary link: `Use a ticket number instead`
### Entry logging
 
`gw:entrants/{entrantId}` now stores:
 
```js
{
  name,
  fp,
  uid,
  entryMode,
  enteredAt,
  won
}
```
 
Existing fields such as `extraEntries` remain supported.
 
### Profile activity
 
When signed in, Giveaway entries are also recorded under:
 
```text
/users/{uid}/activity/giveawayEntries/{generatedId}
```
 
Payload includes:
 
- `sessionId`
- `sessionCode`
- `entrantId`
- `displayName`
- `enteredAt`
- `recordedAt`
---
 
## Diagnostics and field-debug behavior
 
The diagnostics panel is still available, but it is no longer shown to normal QR attendees.
 
Current behavior:
 
```js
function shouldShowDiagnostics(isHost) {
  if (isHost) return true;
  return new URLSearchParams(window.location.search).get("debug") === "1";
}
```
 
Diagnostics are shown when:
 
- user is a host, or
- URL includes `?debug=1`.
This prevents normal attendees from seeing scary internal `PERMISSION_DENIED` messages during a claim/entry flow.
 
For debugging a public QR flow, manually append `debug=1` to the URL. If there is already a query parameter, use `&debug=1`.
 
Examples:
 
```text
/event-tools/?cd_claim=abcd1234&debug=1
/event-tools/?gw_join=abcd1234&debug=1
```
 
---
 
## Firebase data model additions
 
### `/roles/hosts/{uid}`
 
Boolean host-role map.
 
Current import:
 
```json
{
  "hosts": {
    "yF2TJjk9jZf16kNwr2MGvWNbk9E3": true
  }
}
```
 
### `/users/{uid}`
 
Community profile root.
 
Created/updated by `ensureCommunityProfile(user)`.
 
Known fields:
 
```js
{
  displayName,
  email,
  photoURL,
  ageConfirmed,
  createdAt,
  lastLoginAt,
  trainerName
}
```
 
### `/users/{uid}/linkedClientIds/{safeClientId}`
 
New v2.12.14 path replacing global `/migrations/{safeClientId}`.
 
Purpose:
 
- Link the random browser client ID to the signed-in user profile.
- Keep mapping owned by the signed-in user's profile.
- Avoid global migration permission errors on attendee pages.
Payload:
 
```js
{
  linkedAt,
  clientId
}
```
 
### `/users/{uid}/activity/codeClaims/{activityId}`
 
Signed-in Code Drop activity history.
 
### `/users/{uid}/activity/giveawayEntries/{activityId}`
 
Signed-in Giveaway activity history.
 
### `cd:sessionLog` additions
 
Adds:
 
```js
uid,
entryMode
```
 
### `gw:entrants/{entrantId}` additions
 
Adds:
 
```js
uid,
entryMode
```
 
---
 
## Security rules / permissions notes
 
The v2.12.8 handoff stated that the rules file from v2.9.4 was still current at that time. Since v2.12.12-v2.12.14 added `/users/{uid}` profile/activity writes and `/roles/hosts/{uid}` host checks, the Firebase rules should be audited before this feature set is considered final.
 
Minimum rules requirements:
 
- Signed-in user can read/write their own profile fields under `/users/{uid}`.
- Signed-in user can create/update their own `trainerName`.
- Signed-in user can create activity records under their own `/users/{uid}/activity/...` buckets.
- Signed-in user can read/write their own `/users/{uid}/linkedClientIds/...` records.
- Normal users cannot read/write other users' profiles.
- Normal users cannot modify `/roles`.
- Hosts can read role-gated app data as needed.
If profile writes fail, the main claim/entry flows should continue; however, diagnostics may show permission errors when `debug=1` or as host.
 
---
 
## Privacy implications
 
v2.12.12-v2.12.14 meaningfully expands what the app collects and stores.
 
Data currently collected or generated can include:
 
- Google display name
- Google email address
- Google profile photo URL
- Firebase Auth UID
- Public trainer name
- Age confirmation flag
- Account creation and last-login timestamps
- Random per-browser client ID
- Linked client IDs under the user's profile
- Code claim history
- Giveaway entry history
- Giveaway winner status and prize assignment records
- Bonus entry counts in giveaway sessions
- Local guest mode/name values in browser storage
- Imported Campfire/Topi meetup stats data, where applicable
Recommendation: publish a visible privacy policy before promoting Google sign-in/profile history as a long-term community feature.
 
Suggested WordPress URL:
 
```text
/privacy-policy/
```
 
Places to link it:
 
- Site footer
- Event Tools home screen
- QR sign-in card
- Age confirmation screen
- Google OAuth consent screen configuration
- Any future account/profile page
Important principle: never display attendee email addresses in public host callout flows. Emails should remain private account identifiers only.
 
---
 
## Technical gotchas carried forward
 
These are mandatory patterns for every future release.
 
### 1. No JSX `&&` expressions
 
Do not use:
 
```jsx
{view === "codedrop" && isHost ? <CodeDropApp /> : null}
```
 
Use precomputed variables instead:
 
```js
const showCodeDrop = view === "codedrop" ? isHost : false;
```
 
Then:
 
```jsx
{showCodeDrop ? <CodeDropApp /> : null}
```
 
Reason: WordPress has previously encoded `&&` as `&#038;&#038;`, creating Babel parse errors or blank pages.
 
### 2. No React components inside hooks/render bodies
 
Components must be stable top-level named functions. Do not create JSX-returning component functions inside a hook or another component.
 
Good:
 
```js
function ConfirmModal(...) { ... }
```
 
Bad:
 
```js
function useConfirm() {
  const ConfirmUI = () => <div />;
  return { ConfirmUI };
}
```
 
### 3. Keep Babel/JSX runtime pinned
 
Required:
 
```html
<script src="https://unpkg.com/@babel/standalone@7.29.7/babel.min.js"></script>
<script type="text/babel" data-presets="react">
/** @jsxRuntime classic */
```
 
### 4. Keep attendees away from diagnostics by default
 
Diagnostics are for hosts/debug. QR attendees should not see internal Firebase permission errors.
 
### 5. Google sign-in is not public identity
 
Do not use email or Google display name as the host callout identity. Use public trainer name or generated ticket number.
 
---
 
## Pre-delivery checklist
 
Run before every new HTML delivery.
 
```text
[ ] File name and APP_VERSION match.
[ ] Babel is pinned to @7.29.7.
[ ] Classic JSX runtime pragma is present.
[ ] No import/export statements.
[ ] No native confirm() calls.
[ ] No encoded &#038; artifacts.
[ ] No JSX && expressions.
[ ] Any new React component is a top-level named function.
[ ] TypeScript/Babel JSX parse/transpile check passes.
[ ] WordPress paste smoke test passes.
[ ] Host login / host role check works.
[ ] Direct Code Drop QR flow works as guest.
[ ] Direct Code Drop QR flow works when signed in.
[ ] Direct Giveaway QR flow works as guest/ticket number.
[ ] Direct Giveaway QR flow works when signed in.
[ ] No attendee diagnostics unless ?debug=1.
[ ] Privacy Policy link target exists or is intentionally pending.
[ ] Firebase rules support any new DB paths.
```
 
---
 
## Open items
 
### Immediate / next session
 
1. Draft and publish privacy policy at `/privacy-policy/`.
2. Add the privacy policy URL to any Google OAuth consent screen settings.
3. Audit Firebase rules for `/users/{uid}/activity/...` and `/users/{uid}/linkedClientIds/...`.
4. Consider adding a minimal Terms / Community Guidelines page.
5. Decide whether profile activity should include raw redemption codes long-term or only metadata/code IDs.
### Product / feature backlog
 
1. Public account/profile page where users can edit public trainer name.
2. Profile history screen for code claims and giveaway entries.
3. Passport/progress system.
4. Optional high-value giveaway entry-token mode.
5. Multi-host role management UI.
6. GitHub repository organization.
7. Vite + Firebase Hosting migration when the paste-HTML workflow becomes the bottleneck.
8. QR code shareable link/copy action.
9. Public sponsor/city-hall stats dashboard.
10. Event metadata/categorization.
11. CORS proxy redundancy.
12. Phase 2 Campfire event association.
---
 
## Quick-start for next session
 
Use this order of context:
 
1. `ggpogo-engineering-reference-2_12_2.md`
2. `ggpogo-engineering-reference-2_12_8.md`
3. `ggpogo-engineering-reference-2_12_14.md`
4. `wordpress-block-v2_12_14.html`
5. Current Firebase rules file, if available
6. `roles-import.json`
Recommended next work:
 
1. Draft a plain-English privacy policy.
2. Build a WordPress privacy policy page matching the Garden Grove PoGo brand tone.
3. Add any necessary privacy-policy links to app screens beyond the QR sign-in card.
4. Audit Firebase rules for the new `/users/{uid}` profile/history paths.
5. Begin next minor HTML release only after privacy copy and rules needs are clear.
---
 
## Summary for future Nyx
 
The app now has two identity layers:
 
- Private account identity: Google/Firebase Auth UID, email, profile metadata.
- Public event identity: trainer name or ticket number.
Do not collapse these into one. The host should never have to call out an email address or Google account name. Signed-in users should get profile/history benefits, but public-facing event flow should remain trainer-name/ticket based.
 
v2.12.14 is a working attendee-facing polish release. The next responsible step is privacy policy publication and Firebase rules review before expanding profile/passport features.
 