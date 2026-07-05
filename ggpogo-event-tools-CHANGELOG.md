# GGPoGo Event Tools — Changelog

Full historical changelog for the Event Tools single-file app
(`wordpress-block-v2_12_*.html`). The in-file header/footer only shows
the current `APP_VERSION` — this file is the source of truth for
everything before that.

**Sourcing note:** entries through v2.12.20 are drawn from the
consolidated engineering reference (`ggpogo-engineering-reference-2_12_20.md`),
which itself compiled three earlier handoff documents
(`ggpogo-engineering-reference-2_12_2.md`, `_2_12_8.md`, `_2_12_14.md`,
`_2_12_15.md` — not all present in current project files, but folded into
the v2.12.20 doc's own "Complete version history"). Entries for v2.12.21
and v2.12.22 were reconstructed by diffing the actual delivered HTML files
against each other, since no handoff doc covered that gap. Entries from
v2.12.23 onward are drawn directly from the delivery notes written at the
time, verified against the real diffs.

---

### v1.0 to v2.0 — initial build and Code Drop launch
Code Drop end-to-end: host login, paste-to-add with duplicate detection, session start with QR, attendee claim with device fingerprinting, code + redeem-link reveal, live counters, stash-empty state, pause/resume, end session with history and CSV export, undo-last-claim, low-stock warning, and the branding system.

### v2.2 — data model refactor
`cd:codes` moved from a JS array to an object map to enable per-item security rules. `codesObjToArray`/`codesArrayToObj` introduced. `cd:sessionLog` converted to a push-key object for append-without-read-access.

### v2.2.1 — CodeManage
Multi-select checkboxes, remove-selected, remove-all, per-code claimed toggle. Became the reference pattern for the Giveaway prize pool.

### v2.2.2 — Babel parse fix
"Unexpected digit after hash token" from `c.purple + "1a"` inside a JSX ternary. Fixed by precomputing concatenated color+hex values before JSX. This pattern recurs.

### v2.2.3 — session-resume fix
`CodeDropApp` screen state now derives from whether `cd:session` exists; guards `startSession()` against overwriting a live session.

### v2.2.4 — critical claim-flow fix
The claim flow had been silently failing on every write since the v2.2 rules went live, while showing a success screen anyway. Two root causes: two separate `.set()` calls each failing the final-state rule check, and full-node overwrites of parents the rules don't grant. Fixed with atomic `FB.update()` to exact child paths and a "claimerror" stage.

### v2.2.5 — hooks-order fix
Two `useState` calls placed after early returns violated the Rules of Hooks (blank page, no console errors). Moved all hooks to the top.

### v2.2.6 — diagnostics system
Added ErrorBoundary, CrashScreen, DiagnosticsPanel, reportIssue/useDiagnostics, and global error/rejection listeners.

### v2.2.7 — emoji button sizing
Introduced the `Icon` SVG component to replace emoji UI icons that ballooned on Windows/Edge.

### v2.3.0 — Giveaway feature
Prize pool, QR self-entry, manual entry, slot-machine draw, atomic winner confirmation, history with CSV. Code Drop was field-confirmed; Giveaway was built but not yet field-tested.

### v2.5.0 — prize types, anti-refresh, sequential/expiring codes
Four prize types; the one-code-per-device refresh exploit fixed (read `cd:claims/${fp}` directly); `order` and `expiresAt` on codes with oldest-first selection; CSV import; date-range history export.

### v2.5.1 — concurrency hardening
`FB.transact` plus `claimCodeNode`, `registerClaim`, `incrementCounter`/`decrementCounter`. Fixed dropped increments, spurious loser-gets-error under load, undo-erasing-concurrent-claims, and an O(n) win-listener rescoped to per-entrant.

### v2.6.0 — reward labels
Human-readable `reward` field on codes, per-batch or per-code, shown on reveal screens. CSV extended to `code,expiresAt,reward`.

### v2.6.1 — transaction fix and emoji replacement
Fixed `claimCodeNode` aborting on Firebase's initial null-guess pass (every claim failing silently). Replaced remaining host-UI decorative emoji with SVGs; added image onError fallbacks to BrandingSettings.

### v2.7.0 — Meetup Stats
Host-only RSVP/check-in aggregation from Campfire via Cloudflare Worker proxy, based on a 23-page API handoff. Privacy-stripped caching.

### v2.10.0 / v2.10.1 — (blank page incident and the Babel pin)
A production blank page traced to an unpinned Babel Standalone CDN reference serving an automatic-runtime build. Fixed permanently by pinning `@7.29.7`, adding `data-presets="react"`, and the `/** @jsxRuntime classic */` pragma.

### v2.11.0 / v2.11.1 — session-aware landing page
AttendeeHome now watches `cd:session`/`gw:session` and shows only tiles for running tools, or a community landing between events. v2.11.1 fixed tiles routing unauthenticated attendees through the host gate; they now navigate directly to the claim/join URL. This release also established the rule that every distinct delivery bumps the patch number even if the prior one was never deployed.

### v2.12.0 — Campfire event association
`findClosestEvent` suggests the nearest cached event within 12 hours; `eventId`/`eventName` stored on the session, carried into history and CSV exports. Labeling only; cross-referencing attendance deferred to Phase 2.

### v2.12.1 — fingerprint collision incident
Attendees on the same phone model were recognized as the same person. The deterministic hardware-trait hash was identifying phone model, not person. Rewritten to a random `crypto.randomUUID()` stored in `ggpogo_client_id_v1`, with a storage-availability fallback. Function name and return type unchanged so no call sites or rules needed edits.

### v2.12.2 — on-page version footer
Low-opacity APP_VERSION tag, bottom-left. APP_VERSION must now be bumped to match the filename on every release — a permanent checklist step.

### v2.12.3 — bonus entries and entry-order numbers
`#N` order badges on the entrant list; weighted bonus entries via a new `extraEntries` field and `buildWeightedPool`.

### v2.12.4 / v2.12.5 — UX improvements (with a blank-page fix)
v2.12.4 shipped a blank-page bug; v2.12.5 fixed it and carried the improvements: bonus minus button, inline confirm dialogs replacing native `confirm()`, Start button promoted above collapsible setup panels, downplayed Skip buttons, session-code explanations to attendees, live entrant count on the waiting screen, last-session summaries on dashboard cards.

### v2.12.6 / v2.12.7 — mobile date-input fixes
`box-sizing: border-box` and `min-width: 0`, then a full fix with `-webkit-appearance: none` on date inputs and a narrow-screen stacking class for paired From/To rows.

### v2.12.8 — host login emoji fix
Replaced the oversized lock emoji on the host login screen with the logo mark.

### v2.12.9 to v2.12.12 — community auth foundation
Google sign-in, age gate, guest mode and banner, sign-in chooser, `/users/{uid}` profiles, `/roles/hosts/{uid}` lookup, `checkHostRole`, `ensureCommunityProfile`, initial UUID-to-UID migration. Removed the old email/password HostLogin. Worked through a sequence of bugs: components nested inside StatusPill from a bad insertion, orphaned function bodies, `signInWithRedirect` failing without Firebase Hosting (switched to `signInWithPopup`), and rules blocking the new paths.

### v2.12.13 — optional Google sign-in inside QR flows (Nyx/ChatGPT)
`OptionalProfileSignInCard`; auth props threaded into CodeClaim/GiveawayClaim; URL parsing split from auth listening; age gate moved ahead of QR routing; `uid`/`entryMode` on log and entrant records; activity writes under `/users/{uid}/activity/`; risky JSX `&&` routing replaced with precomputed `show*` booleans.

### v2.12.14 — QR-flow polish and privacy-conscious copy (Nyx/ChatGPT)
Trimmed QR copy; reframed sign-in as a private profile; renamed to "Public trainer name"; signed-in users can claim Code Drop without a public name; ticket-number option for anonymous giveaway entry; no email shown in QR flow; compact privacy-policy link; `loadSavedProfileTrainerName`; client-ID linking moved to `/users/{uid}/linkedClientIds/`; diagnostics host-gated.

### v2.12.15 — Firebase US-region migration
New project `ggpogo-tools-us` in us-central1 to cut ~150-200ms Belgium latency to ~40-50ms. Full JSON export/import, re-established Google sign-in, rules, and host role. Config updated; no code-logic changes. Old `ggpogo-tools` retained dormant as backup. Note: Firebase Auth UIDs are project-scoped, so all UIDs reset (practical impact zero, since only the admin had signed in).

### v2.12.16 — trainer name chooser
`TrainerNameChooser` overlay shown once after first sign-in when the profile has no trainer name. Skippable per session, blank input, editable later. Saves to `/users/{uid}/trainerName` and `ggpogo_trainer_name`. Render order: age gate, QR routes, auth loading, then the chooser, then home — so QR claim flows are never interrupted. This delivery also folded in the v2.12.15 US config (the prior working source predated it).

### v2.12.17 — privacy policy links
Added `/privacy-policy/` links to AgeGate, TrainerNameChooser, and the AttendeeHome footer, joining the existing QR-card link (four total).

### v2.12.18 — claim sort order and session-specific count
Added `claimedAt` timestamps to claims (written on claim, cleared on undo/unclaim, set on manual mark), parsed and persisted in the code helpers. "Recently claimed" now sorts newest-first. The live screen's claimed tile shows the session-specific count labeled "THIS SESSION"; the splash page keeps the all-time total.

### v2.12.19 — check-in history (My Activity)
`ActivityHistory` view reading `/users/{uid}/activity/codeClaims` and `giveawayEntries`, merged and grouped by date, newest first. Code entries show the code, reward, and meetup name; giveaway entries show the meetup name. A "My Activity" button appears on AttendeeHome for signed-in users. Both `recordProfileActivity` calls now include `eventName` from the session, so future records show the meetup.

### v2.12.20 — activity emoji sizing
Constrained the My Activity emoji icons (empty-state and timeline rows) with reduced font sizes, `lineHeight: 1`, and `overflow: hidden`, matching the project's icon discipline.

### v2.12.21 — Manual code overlay (host-side)
Added a "Manual" button to the Code Drop live session screen for handing a code to someone without a QR scan — claims the next unclaimed candidate the same way the attendee flow does (sequential, retry-on-conflict), then shows a full-screen overlay with the code, a redeem link, a scannable QR pointing at the store redemption page, copy/share buttons, and the reward label if one is set. Registers under a synthetic `manual_<timestamp>` key so it can still be found and removed by undo. Also renamed the End Session button's label from "End Session" to "End" and its in-progress state from "Ending…" to "Ending...".

### v2.12.22 — per-event code/prize stats in Meetup Stats
Cross-referenced Code Drop and Giveaway session history against Campfire events for the first time. New `buildEventCountMap` helper sums claims (`cd:history`) or draws (`gw:history`) per `eventId`. This powers: a new "Last Event Stats" card (RSVPs, check-ins, codes distributed, prizes given, check-in rate) shown both on the Meetup Stats dashboard and the full stats screen; "Codes distributed" / "Prizes given" tiles added to the date-range summary; per-event code/prize counts added to the Top Events ranking tables; and two new columns ("Codes", "Prizes") added to the CSV export.

### v2.12.23 — rotating claim token, simplified claim/reveal pages, expiry-first redemption
Three changes, prompted by two unauthorized "Anonymous" claims traced to a static `?cd_claim=<sessionId>` link that never expired for the life of a session:
- **Rotating claim token:** `cd:session` gained `claimToken`/`prevClaimToken`/`claimTokenAt`. The host's live screen rotates the token every 60 seconds (one grace cycle so a scan right as the QR flips still works); both the QR/link and the attendee-home "event happening now" tile now embed it. A stale token lands on a new "Scan again" screen instead of succeeding. Fully anonymous-compatible — no auth requirement added. Enforced client-side in the claim page, matching the existing trust level of the session-ID check (not yet pushed into Firebase security rules).
- **Simplified claim and reveal pages:** claim page reduced to one optional name field and one button (blank name = anonymous by default, no separate anonymous action); sign-in demoted to a small link via a new `compact` mode on `OptionalProfileSignInCard`. Reveal page reduced to code + reward, redeem button, copy/share, and one collapsed account-warning line; the "show this session code to the host to verify" block was cut, since the rotating token now covers that.
- **Expiry-first redemption:** new shared `byClaimPriority` comparator (soonest-`expiresAt`-first, `order` as tiebreaker) applied to all three real claim paths (attendee claim, host manual claim, giveaway code-prize draw) — previously all three claimed strictly in entry order regardless of expiration, so a batch added later but expiring sooner could sit unused behind an earlier, longer-lived batch.

### v2.12.24 — sortable Manage Codes table, "Added" tracking, bulk add on Manage Codes
- **Sortable columns:** Code, Status, Expires, and Added headers on Manage Codes are now clickable (click to sort, click again to flip direction), via a new `SortableHeader` component. Display-order-only — never affects `byClaimPriority`/redemption order.
- **"Added" tracking:** new `addedAt` field recorded on every code-creation path going forward (single add, line-paste batch, CSV batch, and the new Manage Codes bulk-add). One timestamp per batch, not per line. Threaded through `codesObjToArray`/`codesArrayToObj` so it survives every round-trip (delete-selected, clear-claimed, clear-expired, giveaway draw), not just the creation writes. Codes added before this version show as `—`; no backfill, since the only historical record (`cd:history`) only covers already-claimed codes and would produce an inconsistent mix of real and blank dates.
- **Bulk add on Manage Codes:** ported the paste-list and CSV-mode UI from the Code Drop setup screen directly into Manage Codes (same dedup logic, same `code,expiresAt,reward` CSV format), closing the gap where bulk import was only available from the Code Drop dashboard.
