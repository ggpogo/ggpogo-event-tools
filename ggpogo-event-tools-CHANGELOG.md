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

### v2.13.0 — Passport: self check-in, milestone and named event badges
Third first-class tool alongside Code Drop and Giveaway, with its own independent session lifecycle (`pp:session`, `pp:checkInLog`, `pp:history` — a host can run check-in without necessarily running Code Drop or Giveaway that day).

- **Self check-in:** signed-in attendees see a "Check in" button, enabled only when `navigator.geolocation` confirms they're within 600m (`CHECKIN_RADIUS_METERS`, Haversine via `distanceMeters`) of the session's coordinates. Default location is Garden Grove Park (`DEFAULT_EVENT_LOCATION`, 9301 Westminster Blvd — 33.7620, -117.9672), host-overridable per session. Denied/failed geolocation shows "Trouble checking in?" instead of a disabled button.
- **Host-manual fallback:** since the host's device never has the attendee's uid (no by-name user lookup exists), "manually check someone in" is fulfilled via a shareable link (`?pp_checkin={sessionId}`) the host copies and hands to the attendee, who completes their own check-in on their own device with their own uid via the new `PassportManualCheckIn` component — sign-in required, geofence skipped (host-vouched instead). A same-device name-only "note" option also exists for the host's own record but does NOT credit any passport on its own — flagged clearly in-UI to avoid the false impression that it does.
- **Named badges:** automatic for Community day and Special events (`EVENT_TYPES[].alwaysNamed`); toggle-enabled per type for Raid hour / Custom via the new Passport Settings screen (`settings:passport.badgeTypesEnabled`). Badge id is derived from the session id (`named-{session.id}`), not the event name text, so two sessions with identical names are always two distinct badges, and a badge already earned is a permanent snapshot (label/icon/eventType/earnedAt) independent of the source session surviving.
- **Badge icon auto-detect:** `guessPokemonNameFromEventName` best-effort parses a Pokemon name from the event name text (splits on known event-type keywords, rejects multi-word leads to avoid false positives like "Garden Grove" from "Garden Grove Raid Hour"). Resolves to `raw.githubusercontent.com/ggpogo/ggpogo-pokemon-icons/main/{name}.png` via `pokemonIconUrl`. Host sees a live preview before starting the session and can override with a custom image URL; falls back to the GGPoGo logo (`DEFAULT_BADGE_ICON`) on any load failure or unmatched name. `ggpogo-pokemon-icons` repo created or connected as the source-of-truth image library (empty at launch — see "on the horizon" in the website handoff for backfill status, hosted on GitHub rather than Google Drive/OneDrive since those services don't produce reliable direct-hotlink URLs for this use case).
- **Milestone badges:** unsplit by event type, based on distinct check-in count. Thresholds configurable in Passport Settings (`settings:passport.milestoneThresholds`, default `[1,5,10,25]`), not hardcoded.
- **My Passport / Public Passport:** private by default; opt-in `shareable` flag (`users/{uid}/passport/shareable`) generates a `?passport={uid}` link, rendered by the new no-login `PublicPassport` component (trainer name + badges only — never email or real name). Both private and public views share one `PassportBadgeDisplay` component so they can't visually drift apart. Named badges grouped and filterable by event type on both views.
- **Passport Settings:** new host-only screen, kept separate from Branding Settings since these are feature/behavior toggles, not visual identity.
- **Firebase rules:** four new top-level paths (`pp:session`, `pp:checkInLog`, `pp:history`, `settings:passport`, all `auth != null` matching the existing `cd:`/`gw:` host-path pattern) plus one new *kind* of rule — a public-read carve-out into `users/{uid}/passport/badges` and `.../checkIns`, gated on that same user's own `shareable` flag being `true`. Everything else under `users/{uid}/passport/*` (including `shareable` itself for writes) stays covered by the pre-existing self-uid-only `users/{uid}` rule.
- **Post-delivery correction:** the first delivered build had one raw `&&` inside a JSX checkbox attribute (`checked={badgeEnabled && typeToggledOn}`) that survived a pre-delivery grep because the check only flagged the classic `{cond && <jsx>}` conditional-render shape as risky. It shipped, WordPress's Custom HTML block sanitizer corrupted it to `&#038;&#038;` on save (a known, long-standing Gutenberg behavior — see WordPress core ticket #34698 and multiple open Gutenberg issues, not the older `wptexturize` text-node bug, which was already fixed WP 4.4+), and the page failed to load with `Uncaught SyntaxError: Unexpected digit after hash token`. Fixed by rewriting all 8 occurrences introduced by this delivery as nested `if`/ternary equivalents and re-verifying by literal `&&` count against the whole script block (now zero), not by classifying which shapes "look" dangerous. This is now a standing pre-delivery check, not a one-time fix.

### v2.13.1 — dropdown arrow styling, Campfire event picker for Passport, event-type auto-suggest
- Added `padding-right`, a custom SVG chevron, and `appearance: none` to all `<select>` elements (attempted fix for a text-clipping report — see v2.13.2/v2.13.3, this did not fully resolve it).
- Passport's session-start "Event name" field replaced with the same Campfire event dropdown Code Drop/Giveaway already use (`stats:cache.events`, defaulting via `findClosestEvent`), plus a "Type a name instead…" fallback for unsynced events. New `guessEventTypeFromName` matches the selected event's title against Community day / Raid hour / Special-event keywords and pre-selects Event type; stops overriding once the host touches that dropdown directly (`typeManuallySet`).
- One raw `&&` was introduced and caught by the (now-standing) pre-delivery zero-`&&` check before delivery, in `selectCampfireEvent`'s type-guess guard — fixed the same way as the v2.13.0 correction.

### v2.13.2 — default-event and badge-icon-crop fixes
- **Wrong default event:** `findClosestEvent` (built for Code Drop/Giveaway's "link to the event happening right now" case) only matches within a 12-hour window of the current time — with no events that close, it always returned `null`, so Passport's dropdown silently fell back to whatever rendered last rather than the next upcoming event. Added a separate `findNextUpcomingEvent` helper (soonest future event, no time cap) for Passport specifically; also sorted the dropdown's own option list soonest-first.
- **Badge icon not filling the circle:** both badge icon renders (session-start preview, `PassportBadgeDisplay`'s earned-badge grid) used a smaller fixed-size `object-fit: contain` image centered inside a larger circle, leaving visible padding. Changed to `object-fit: cover` at 100% of the circle's dimensions per explicit request (crop to fill, rather than pad to fit) — applies to both the GGPoGo logo default and future Pokemon sprites.

### v2.13.3 — dropdown text clipping (still unresolved — see note)
Two attempted fixes for the same report (`<select>` text visually clipped top/bottom) before finally inspecting DevTools directly:
- v2.13.1 attempt: added `line-height: 1.3` and split `padding` into top/bottom, theorizing a line-height/font-metric mismatch. Did not fix it.
- v2.13.3 attempt: DevTools Computed panel showed the actual box was 420×40px with 12px+12px vertical padding already consuming 24px, leaving only 16px for 15px text — reduced padding to 10px top/bottom and added `min-height: 46px`. **Reported by the user as still not fixed after this change**, meaning the height-math theory was also wrong, or something else is overriding these rules at render time. DevTools also showed `-webkit-appearance: none` rendered struck-through (not applying) in the Computed panel for this element, which may or may not be related.
- **Not yet resolved.** Handed off for a second diagnostic pass rather than a third guess. Next step should probably be checking actual rendered (not just declared) `font-size`/`height` on the live element post-WordPress-render, and checking whether some other rule elsewhere in the file (or a WordPress/theme-level style) is overriding `#ggpogo-event-tools-root select` with higher specificity or later source order.


### v2.13.4 — Passport dropdown clipping fix
Resolved the Passport session-start dropdown text clipping that remained after the v2.13.1 and v2.13.3 attempts.

- **Root cause confirmed by behavior:** padding/line-height tuning alone was not enough for the native `<select>` controls. The rendered dropdown continued clipping text even after reducing vertical padding and adding `min-height`, so the issue was treated as a native-control sizing problem rather than another font-metric/padding tweak.
- **Global select fix:** changed the shared `#ggpogo-event-tools-root select` rule to use an explicit `height: 48px` / `min-height: 48px`, removed vertical padding with `padding: 0 42px 0 14px`, reset `line-height: normal`, kept the custom chevron, and added `background-color`, `display: block`, `overflow: visible`, `white-space: nowrap`, and `text-overflow: ellipsis` to make the selected text render cleanly.
- **Passport-specific hardening:** applied the same fixed-height/padding/line-height values directly to the two Passport setup dropdowns (`Event` and `Event type`) as inline styles, reducing the chance that WordPress/theme CSS or browser-native select styling could reintroduce the clipping on the affected controls.
- **Version/checklist:** bumped `APP_VERSION` from `v2.13.3` to `v2.13.4` and re-verified the standing WordPress safety check: zero raw `&&` occurrences in the delivered HTML.

### v2.13.6 — code claims earn Passport badges; bright login CTA on claim page
Signed-in Code Drop claims now feed the same shared Passport milestone counter as check-ins and can award a session's named badge (new "Passport Badge" config on Code Drop's Session Settings), and the claim page's sign-in prompt was promoted to a full-width bright button ("Log in to earn a badge!") using the Icon SVG system instead of a raw emoji, which had rendered oversized on some browsers.
