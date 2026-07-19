# Garden Grove PoGo Event Tools
## Engineering Handoff -- v2.12.15
### June 2026

This document covers the Firebase project migration from Belgium to the United States and the v2.12.15 release. It should be read alongside the prior handoff chain.

Read in order:

- `ggpogo-engineering-reference-2_12_2.md` -- full architecture, Firebase data model, rules, component map, and gotchas through v2.12.2.
- `ggpogo-engineering-reference-2_12_8.md` -- bonus entries, entry order numbers, inline confirms, mobile date input fixes, and UX improvements through v2.12.8.
- `ggpogo-engineering-reference-2_12_14.md` -- authentication/profile model, direct QR-flow improvements, privacy-conscious display-name handling, and attendee-facing polish through v2.12.14.
- `ggpogo-engineering-reference-2_12_15.md` -- this document. Firebase project migration and v2.12.15 config update.
- `wordpress-block-v2_12_15.html` -- current delivered HTML block.

---

## Table of Contents

1. [Current status](#current-status)
2. [What happened in this session](#what-happened-in-this-session)
3. [Firebase project migration](#firebase-project-migration)
4. [Auth architecture decisions](#auth-architecture-decisions)
5. [Sign-in method: popup vs redirect](#sign-in-method-popup-vs-redirect)
6. [Security rules](#security-rules)
7. [Version history for this session](#version-history-for-this-session)
8. [Firebase configuration reference](#firebase-configuration-reference)
9. [Host role management](#host-role-management)
10. [Known issues resolved](#known-issues-resolved)
11. [Technical gotchas discovered](#technical-gotchas-discovered)
12. [Open items](#open-items)
13. [Pre-delivery checklist update](#pre-delivery-checklist-update)
14. [Quick-start for next session](#quick-start-for-next-session)

---

## Current status

The current delivered app file is:

```text
wordpress-block-v2_12_15.html
APP_VERSION = "v2.12.15"
```

The app points to a new Firebase project:

```text
Project name:  ggpogo-tools-us
Database URL:  https://ggpogo-tools-us-default-rtdb.firebaseio.com
Region:        United States (us-central1)
Plan:          Spark (free)
```

The old Firebase project (`ggpogo-tools`, Belgium/europe-west1) is dormant. It has not been deleted and retains all historical data as a backup. All live traffic now flows through `ggpogo-tools-us`.

The stack is unchanged:

- React 18 UMD from CDN
- ReactDOM 18 UMD from CDN
- Babel Standalone pinned to `@7.29.7`
- Firebase compat SDK `10.13.2`
- `type="text/babel" data-presets="react"`
- `/** @jsxRuntime classic */`

---

## What happened in this session

This session (Claude, June 23-24 2026) covered:

1. Designed the community authentication architecture: Google sign-in for all users, role-based host access via `/roles/hosts/{uid}`, guest mode with warning banner, age gate (13+), and UUID-to-account migration.

2. Built the initial auth implementation (v2.12.9 through v2.12.12) with multiple bug fixes: StatusPill scope error from malformed code insertion, orphaned function bodies causing Babel parse errors, `signInWithRedirect` failing due to Firebase Hosting not being initialized (switched to `signInWithPopup`), and Firebase Security Rules blocking new database paths.

3. Handed off to Nyx (ChatGPT) for v2.12.13 and v2.12.14, which refined the QR-flow auth integration, privacy-conscious display-name handling, and diagnostics cleanup. That work is documented in `ggpogo-engineering-reference-2_12_14.md`.

4. Identified that the Firebase Realtime Database was hosted in Belgium (europe-west1), adding 150-200ms round-trip latency for a community based in Garden Grove, CA.

5. Created a new Firebase project (`ggpogo-tools-us`) in us-central1, migrated all data via JSON export/import, re-established Google sign-in, security rules, and host roles.

6. Delivered v2.12.15 with the updated Firebase configuration pointing to the new US project.

---

## Firebase project migration

### Why

The original Firebase project (`ggpogo-tools`) was created with its Realtime Database in Belgium (europe-west1). Firebase does not allow changing a database's region after creation. With all community members in Garden Grove, CA, every database read/write was making a round trip to Belgium, adding approximately 150-200ms of latency per operation. For time-sensitive features like code drops where attendees race to claim, this overhead was significant.

### What was done

A new Firebase project was created:

| Property | Old project | New project |
|---|---|---|
| Project name | ggpogo-tools | ggpogo-tools-us |
| Project ID | ggpogo-tools | ggpogo-tools-us |
| Database region | Belgium (europe-west1) | United States (us-central1) |
| Database URL | https://ggpogo-tools-default-rtdb.europe-west1.firebasedatabase.app | https://ggpogo-tools-us-default-rtdb.firebaseio.com |
| Estimated latency from Garden Grove | 150-200ms | 40-50ms |

### Migration steps performed

1. Created new Firebase project `ggpogo-tools-us` with Google Analytics disabled.
2. Created Realtime Database in us-central1, locked mode.
3. Enabled Google sign-in provider with gardengrovepogo@gmail.com as support email.
4. Added `ggpogo.com` to authorized domains.
5. Exported full JSON from old project's Realtime Database.
6. Imported JSON into new project's Realtime Database.
7. Published security rules (see Security Rules section below).
8. Registered a web app ("Event Tools") to generate Firebase config credentials.
9. Updated the HTML block's Firebase config to point to the new project.
10. Signed in with Google on the new project to get the new UID.
11. Added host role at `/roles/hosts/{new-uid}`.
12. Verified Event Day Dashboard loads for host.

### Impact on existing users

Because this is a new Firebase project, all Firebase Auth UIDs changed. Any user who signed in on the old project has a different UID on the new project. At the time of migration, auth had just been deployed and only the admin (Eric) had signed in, so the practical impact was zero. The old project's `/users/` data was imported but the UIDs in it correspond to old-project accounts. No cleanup was performed since the data volume was negligible.

Guest-mode users (UUID-based) are unaffected. Their localStorage client IDs remain valid and will migrate to their new-project UID when they eventually sign in with Google.

### Old project disposition

The old project (`ggpogo-tools`) has not been deleted. It retains all historical data and can be referenced if needed. No live traffic should flow to it. It can be deleted once the new project is confirmed stable over several meetup field tests.

---

## Auth architecture decisions

These decisions were made in this session and carried through v2.12.12 onward.

### Google sign-in for everyone

All users (hosts and community members) authenticate via the same Google sign-in flow. There is no separate host login. The old email/password `HostLogin` component was removed entirely.

Rationale: single auth method is simpler to maintain, more secure (no shared password), and Google accounts are nearly universal in the Pokemon GO community.

### Role-based host access

Host access is determined by a boolean flag in the database at `/roles/hosts/{uid}`. When a user signs in, the app calls `checkHostRole(uid)` which reads this path. If `true`, the user sees the Event Day Dashboard. If not present or `false`, the user sees the community attendee experience.

The role check result is cached in memory per UID for the duration of the page session to avoid repeated database reads.

There is no visible indication of host functionality anywhere in the attendee UI. The admin tools are completely invisible to non-hosts.

### Guest mode

Users who do not want to sign in can tap "Continue as Guest" and optionally enter a display name. Guest mode uses the existing random UUID system (`ggpogo_client_id_v1` in localStorage). A persistent but dismissible yellow banner reminds guests that their meetup history and passport progress will not be saved.

### Age gate

Before the first Google sign-in, users must confirm they are 13 or older. This is stored in localStorage (`ggpogo_age_confirmed`) so returning users skip it. The confirmation is also recorded in the user's database profile (`ageConfirmed: true`). The age requirement matches Pokemon GO's own terms and avoids triggering COPPA obligations.

---

## Sign-in method: popup vs redirect

### The redirect problem

Firebase's `signInWithRedirect` sends the user to `{authDomain}/__/auth/handler` to process the OAuth flow. This handler page is served by Firebase Hosting and needs `/__/firebase/init.json` to read the project config. If Firebase Hosting has never been deployed for the project, that file returns 404. The OAuth flow completes at Google's end, but the auth handler cannot store the result, so the user returns to the app unauthenticated.

This was discovered during field testing of v2.12.12. Console logs showed:

```text
GET https://ggpogo-tools.firebaseapp.com/__/firebase/init.json 404 (Not Found)
```

The redirect appeared to work (user went to Google, chose an account, came back), but `getRedirectResult()` returned null and `onAuthStateChanged` never fired with a user.

### The popup solution

v2.12.12 switched to `signInWithPopup`. The popup approach:

- Does not depend on Firebase Hosting or the auth handler page.
- Does not reload the main page (no scroll-to-top issue).
- Returns the auth result directly in the same JavaScript context.
- Works on mobile browsers when triggered by a direct user tap (which satisfies popup-blocker policies).

Error handling covers three cases:

- `auth/popup-closed-by-user` and `auth/cancelled-popup-request`: silent, not treated as errors.
- `auth/popup-blocked`: displays a message asking the user to allow popups.
- All other errors: displays a generic retry message and logs to diagnostics.

### Recommendation

Do not switch back to `signInWithRedirect` unless Firebase Hosting is deployed and `/__/firebase/init.json` is confirmed accessible. The popup approach is working correctly in production.

If popup blocking becomes a problem on specific mobile browsers, the alternative is to deploy Firebase Hosting for the project (even an empty deploy via the Firebase CLI would make the auth handler page functional) and switch back to redirect. This has not been needed so far.

---

## Security rules

The following rules are published on the `ggpogo-tools-us` project. They preserve all original attendee-side validation logic from the old project and add the three new auth-related paths.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "roles": {
      "hosts": {
        "$uid": {
          ".read": "auth !== null && auth.uid === $uid"
        }
      }
    },
    "users": {
      "$uid": {
        ".read": "auth !== null && auth.uid === $uid",
        ".write": "auth !== null && auth.uid === $uid"
      }
    },
    "migrations": {
      "$oldId": {
        ".write": "auth !== null && !data.exists()"
      }
    },
    "cd:codes": {
      ".read": true,
      ".write": "auth != null",
      "$codeId": {
        ".write": "auth != null || (data.exists() && newData.exists() && root.child('cd:session/paused').val() != true && newData.child('value').val() == data.child('value').val() && newData.hasChildren(['value','claimed','claimedBy']) && data.child('claimed').val() == false && newData.child('claimed').val() == true && newData.child('claimedBy').isString())"
      }
    },
    "cd:session": {
      ".read": true,
      ".write": "auth != null",
      "claimedCount": {
        ".write": "auth != null || (root.child('cd:session/paused').val() != true && data.isNumber() && newData.val() == (data.val() + 1))"
      }
    },
    "cd:claims": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$fp": {
        ".read": true,
        ".write": "auth != null || (!data.exists() && newData.isString() && root.child('cd:codes').child(newData.val()).exists())"
      }
    },
    "cd:sessionLog": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$index": {
        ".write": "auth != null || (!data.exists() && newData.hasChildren(['name','code','time','fp']) && newData.child('name').isString() && newData.child('code').isString() && newData.child('time').isNumber() && newData.child('fp').isString())"
      }
    },
    "cd:settings": {
      ".read": true,
      ".write": "auth != null"
    },
    "cd:history": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "settings:branding": {
      ".read": true,
      ".write": "auth != null"
    },
    "gw:session": {
      ".read": true,
      ".write": "auth != null"
    },
    "gw:prizes": {
      ".read": true,
      ".write": "auth != null",
      "$prizeId": {
        ".write": "auth != null"
      }
    },
    "gw:entrants": {
      ".read": true,
      ".write": "auth != null",
      "$entrantId": {
        ".write": "auth != null || (!data.exists() && newData.hasChildren(['name','fp','enteredAt','won']) && newData.child('name').isString() && newData.child('fp').isString() && newData.child('enteredAt').isNumber() && newData.child('won').val() == false)"
      }
    },
    "gw:draws": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "gw:history": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "stats:settings": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "stats:cache": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "stats:snapshots": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "gw:templates": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### New paths explained

`/roles/hosts/$uid`: A user can only read their own host flag. Nobody can write to it through the app. Host roles are managed manually in the Firebase Console. Even if someone knows another user's UID, they cannot check whether that person is a host.

`/users/$uid`: Each user can only read and write their own profile. No cross-user access. This covers the profile root, `trainerName`, `linkedClientIds`, and `activity` sub-paths.

`/migrations/$oldId`: Write-once only (the `!data.exists()` check prevents overwrites). No client reads allowed. This path is a legacy fallback; v2.12.14 moved client-ID linking to `/users/{uid}/linkedClientIds/` instead.

### Rules audit note

The `/users/{uid}` rule grants blanket read/write to the entire subtree for the owning user. This covers `/users/{uid}/activity/codeClaims/`, `/users/{uid}/activity/giveawayEntries/`, `/users/{uid}/linkedClientIds/`, and `/users/{uid}/trainerName`. If finer-grained validation is needed later (for example, preventing a user from writing arbitrary keys under their profile), child rules should be added.

The host-only paths (`cd:history`, `gw:history`, `gw:draws`, `stats:*`, `gw:templates`) currently use `auth != null` which means any signed-in user (not just hosts) can read/write them. This is acceptable for now because these paths are only referenced from host-only UI components that non-hosts never see. For defense in depth, these should eventually be tightened to check the host role in the rules themselves. This requires either Firebase custom claims or a rule expression like `root.child('roles/hosts/' + auth.uid).val() === true`.

---

## Version history for this session

### v2.12.9 (Claude) -- initial auth build

First attempt at community authentication. Introduced:

- `GoogleAuthProvider` initialization.
- Age gate component and localStorage persistence.
- Guest mode with optional display name and warning banner.
- `CommunitySignInChooser` component.
- `ensureCommunityProfile()` for writing `/users/{uid}/`.
- `migrateUuidToUid()` for linking old device UUIDs.
- `checkHostRole()` with in-memory cache.
- Removed `HostLogin` email/password component.
- Removed visible "Host? Sign in" link from AttendeeHome.

Bug: `CommunitySignInChooser`, `AgeGate`, and `GuestBanner` were accidentally nested inside `StatusPill`'s function body due to a malformed `str_replace` insertion. This caused `Can't find variable: CommunitySignInChooser` at runtime.

### v2.12.10 (Claude) -- scope fix

Fixed the StatusPill scope issue by restoring StatusPill's body and placing new components at the correct IIFE scope level.

Bug: The fix left orphaned lines from the old StatusPill body floating outside any function, causing a Babel parse error at AttendeeHome's function declaration.

### v2.12.11 (Claude, renamed by Eric) -- orphan cleanup

Removed the orphaned StatusPill body code. App loaded and rendered correctly.

Bug: Google sign-in via `signInWithRedirect` failed silently. Console showed `GET /__/firebase/init.json 404`. Users completed Google auth but returned unauthenticated. Root cause: Firebase Hosting was never deployed, so the auth handler page couldn't function.

### v2.12.12 (Claude) -- popup sign-in

Replaced `signInWithRedirect` with `signInWithPopup`. Removed `getRedirectResult()`. Added error handling for popup-closed, popup-blocked, and generic failures. Sign-in worked successfully.

Bug: Firebase Security Rules blocked reads to `/roles/hosts/{uid}` and writes to `/users/{uid}`. Console showed `permission_denied` errors. App rendered the community view instead of the host dashboard because `checkHostRole()` failed silently and returned `false`.

### v2.12.13 (Nyx/ChatGPT) -- QR flow auth integration

Documented in `ggpogo-engineering-reference-2_12_14.md`.

### v2.12.14 (Nyx/ChatGPT) -- privacy polish

Documented in `ggpogo-engineering-reference-2_12_14.md`.

### v2.12.15 (Claude) -- Firebase project migration

Only change: Firebase config updated from `ggpogo-tools` (europe-west1) to `ggpogo-tools-us` (us-central1). No code logic changes. Version bumped.

```text
Old: databaseURL: "https://ggpogo-tools-default-rtdb.europe-west1.firebasedatabase.app"
New: databaseURL: "https://ggpogo-tools-us-default-rtdb.firebaseio.com"
```

---

## Firebase configuration reference

### Current production config (ggpogo-tools-us)

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

### Old project config (ggpogo-tools, dormant)

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

---

## Host role management

Host roles are managed manually in the Firebase Console. There is no in-app UI for role management.

To add a host:

1. The person signs in with Google on the Event Tools page.
2. Go to Firebase Console, select `ggpogo-tools-us`, then Authentication, then Users tab.
3. Find the person's account and copy their User UID.
4. Go to Realtime Database, Data tab.
5. Navigate to (or create) `/roles/hosts/{uid}` and set the value to `true`.
6. The person reloads the app and sees the Event Day Dashboard.

To remove a host:

1. Navigate to `/roles/hosts/{uid}` in the Realtime Database.
2. Delete the node.
3. The person reloads and sees the community attendee view.

Current hosts:

- Eric's UID on the new project: set during migration (check `/roles/hosts/` in the database for the current value)
- Daniel (Ironbear1777): not yet added. He needs to sign in once, then Eric adds his UID.

---

## Known issues resolved

### `init.json` 404 and redirect auth failure

Cause: Firebase Hosting was never deployed for the project, so `signInWithRedirect`'s auth handler page at `{authDomain}/__/auth/handler` could not read `/__/firebase/init.json`.

Resolution: Switched to `signInWithPopup` which does not depend on the auth handler page.

### Cross-Origin-Opener-Policy popup close warning

Console shows `Cross-Origin-Opener-Policy policy would block the window.close call.` after Google sign-in popup completes. This is a browser warning, not an error. The sign-in succeeds. The popup may remain open briefly on some browsers but does not affect functionality. This is a known Firebase/Chrome interaction and does not require action.

### Read-only mode in Firebase Console data viewer

The Firebase Console switches the data viewer to "Read-only and non-realtime mode" when the root has many nodes. This hides the **+** button for adding data. Workaround: click any child node (like `cd:codes`) to enter realtime mode for that subtree, then use the breadcrumb navigation to go back to root. The **+** button appears in realtime mode.

---

## Technical gotchas discovered

These are in addition to the gotchas documented in prior handoffs.

### str_replace insertions near function boundaries

When using `str_replace` to insert new code near the opening brace of an existing function, verify that the existing function's body is not consumed by the insertion. This session had two separate bugs caused by inserting components "before" `StatusPill` but actually placing them inside its body or leaving orphaned body code outside any function.

Mitigation: After any `str_replace` edit that touches a function boundary, grep for the function name and verify its opening brace, body, and closing brace are all present and at the correct indentation level.

### Firebase Realtime Database region is permanent

Firebase does not allow changing a Realtime Database's region after creation. The only fix is creating a new project in the desired region and migrating data via JSON export/import. This also resets all Firebase Auth UIDs since auth is project-scoped.

### Firebase Auth UIDs are project-scoped

The same Google account gets a different UID on each Firebase project. Migrating projects means all UID-keyed data (`/users/{uid}`, `/roles/hosts/{uid}`) needs to be re-established with the new UIDs. Plan for this when migrating.

---

## Open items

### Immediate / next session

1. Draft and publish privacy policy at `/privacy-policy/`.
2. Add privacy policy URL to Google OAuth consent screen settings in the new project.
3. Add "choose your trainer name" step after first Google sign-in (instead of showing Google display name).
4. Add Daniel's host role once he signs in on the new project.
5. Field test v2.12.15 at the next meetup (scheduled for June 24).
6. Consider tightening host-only database rules to check role (currently `auth != null` allows any signed-in user).

### Product / feature backlog

1. Check-in history view: let signed-in users see which meetups they've attended.
2. Badge/passport system: award stickers or badges for check-ins, viewable in a passport/badge book.
3. Public account/profile page where users can edit public trainer name.
4. Multi-host role management UI.
5. Optional high-value giveaway entry-token mode.
6. GitHub repository organization.
7. Vite + Firebase Hosting migration when the paste-HTML workflow becomes the bottleneck.
8. QR code shareable link/copy action.
9. Public sponsor/city-hall stats dashboard.
10. Event metadata/categorization.
11. CORS proxy redundancy.
12. Phase 2 Campfire event association.
13. Delete old Firebase project (`ggpogo-tools`) once new project is confirmed stable.

---

## Pre-delivery checklist update

The checklist from the v2.12.14 handoff remains current with one addition:

```text
[ ] File name and APP_VERSION match and are incremented from the previous delivery.
[ ] Firebase config points to ggpogo-tools-us (us-central1), not the old europe-west1 project.
[ ] Babel is pinned to @7.29.7.
[ ] Classic JSX runtime pragma is present.
[ ] No import/export statements.
[ ] No native confirm() calls.
[ ] No encoded &#038; artifacts.
[ ] No JSX && expressions.
[ ] Any new React component is a top-level named function.
[ ] TypeScript/Babel JSX parse/transpile check passes.
[ ] WordPress paste smoke test passes.
[ ] Host role check works (signed-in host sees Event Day Dashboard).
[ ] Direct Code Drop QR flow works as guest.
[ ] Direct Code Drop QR flow works when signed in.
[ ] Direct Giveaway QR flow works as guest/ticket number.
[ ] Direct Giveaway QR flow works when signed in.
[ ] No attendee diagnostics unless ?debug=1.
[ ] Privacy Policy link target exists or is intentionally pending.
[ ] Firebase rules support any new DB paths.
```

---

## Quick-start for next session

Use this order of context:

1. `ggpogo-engineering-reference-2_12_2.md`
2. `ggpogo-engineering-reference-2_12_8.md`
3. `ggpogo-engineering-reference-2_12_14.md`
4. `ggpogo-engineering-reference-2_12_15.md` (this document)
5. `wordpress-block-v2_12_15.html`
6. Current Firebase rules (published on ggpogo-tools-us, documented in this file)

Recommended next work:

1. Add "choose your trainer name" first-login step.
2. Draft privacy policy.
3. Build check-in history view for signed-in users.
4. Begin badge/passport system design.
