// ═══════════════════════════════════════════════════════════════
// GGPoGo Calendar Sync - Cloudflare Worker
//
// Triggered on-demand (POST) from the host-only Calendar Sync panel
// in event-tools.html. Scrapes Leek Duck (authoritative), Dittobase
// and GO Hub (cross-check only), filters to in-scope PoGo events,
// and creates/updates matching entries on the GGPoGo Events Google
// Calendar. Never deletes - anything that disappears from the
// sources gets returned as a "flagged" item for manual review.
//
// ── Required secrets (Settings → Variables and Secrets, type "Secret") ──
//   GOOGLE_SERVICE_ACCOUNT_KEY  - full JSON key for
//     ggpogo-calendar-sync@ggpogo-tools-us.iam.gserviceaccount.com
//   SYNC_TRIGGER_KEY            - shared secret the panel sends as
//     the X-Sync-Key header. Generate any long random string and
//     use the exact same value in the panel's fetch call.
//
// ── Firebase-backed settings and run history (added in WORKER_VERSION
//    v1.1.0) ──
//   Before scraping, each run reads `settings:calendarSync` from the
//   same Firebase RTDB the rest of Event Tools uses (a plain public
//   GET, no auth needed - this project's existing pattern for
//   host-editable, publicly-readable settings). It supplies the
//   inclusion keyword list, which cross-check sources to bother
//   fetching, and the default location, falling back to this file's
//   own hardcoded defaults if the fetch fails or the path is empty,
//   so a Firebase hiccup never breaks a sync.
//   After a run finishes (success or a caught top-level error), the
//   full result is written to `calendarSync:lastRun` (overwritten
//   each time) and appended to `calendarSync:runs` (history, newest
//   entries added via push key) so the panel shows results from any
//   run - manual or a future scheduled one - not just the one it
//   just triggered. Both writes are best-effort: a Firebase write
//   failure here never fails the sync itself, since the calendar
//   side of the job already completed by that point.
//   These two run-history paths currently allow public writes in
//   firebase-database-rules.json, since this Worker has no Firebase
//   Auth identity of its own to write under `auth != null` the way
//   the rest of the app does - reads stay gated to signed-in users.
//   Worth tightening later (e.g. granting the existing Google service
//   account a Firebase Realtime Database IAM role and switching these
//   writes to an authenticated OAuth token) if that tradeoff matters
//   more once this sees real use.
//
// ── Design notes / known v1 simplifications ──
//   - Leek Duck is the only source that drives writes. Dittobase and
//     GO Hub are best-effort cross-checks; if either fails to fetch
//     or parse, the sync still completes off Leek Duck alone and a
//     note is added to `crossCheckIssues` in the response.
//   - Descriptions pull each event's own one-paragraph summary straight
//     from Leek Duck's ".event-description" blurb for Raid Hour, Raid
//     Day, Max Battle Day, and Community Day (a consistent, single-
//     sentence field across those types). GO Fest/Tour/Wild/Finale keep
//     a generic lead line instead, since their pages are long-form
//     prose that's much harder to summarize reliably without scraping
//     getting fragile.
//   - Two separate Mega-related tips can be appended to a description:
//       1) An in-raid attack-boost tip (see buildAttackBoostHint()),
//          only when the event's own text names a specific Mega raid
//          boss. Sourced from Niantic's own Help Center.
//       2) A universal catch-bonus tip (see buildCatchBonusHint()),
//          added to EVERY in-scope event regardless of type. Having any
//          of your own Mega Pokemon actively evolved boosts Catch Candy,
//          Candy XL chance, and Catch XP for ANY catch (wild, research
//          reward, raid, etc.) that shares a type with that Mega, not
//          just catches during a raid. This tip tries to name a
//          specific recommended Mega or two by figuring out what
//          species is featured (checked against MEGA_TYPES first, then
//          against the public PokeAPI for non-Mega-capable species like
//          Legendary raid bosses), and falls back to generic wording
//          when no specific species can be identified.
//   - Raid Hour / recurring-style events are NOT modeled as a single
//     recurring Calendar series. Each week's occurrence is its own
//     dated event, matched by title+date like everything else. True
//     recurring-series editing via the Calendar API (especially
//     around "Road to [Tentpole]" weeks) is a lot more fragile and
//     was deferred - this can be revisited once the pipeline has
//     proven reliable over a few real runs.
//   - Leek Duck's raw event timestamps don't consistently carry a
//     timezone suffix. This script treats them as UTC. VERIFY the
//     first few created events' times against the live Leek Duck
//     page before trusting this fully.
//   - Auth on this endpoint is a single shared secret header, not
//     full user-identity verification - consistent with this
//     project's existing "host-only paths gate on auth != null"
//     posture (see the engineering handoff). Acceptable for this
//     project's scale; the operation is idempotent-ish (dedup logic
//     prevents runaway duplicate creation) even if triggered more
//     than intended.
// ═══════════════════════════════════════════════════════════════

const CALENDAR_ID = "0b71cbdb2aa62006ef5ae863c91dfe647ae938a078ab0971a77c9b0d8910cbdc@group.calendar.google.com";
const DEFAULT_LOCATION = "Garden Grove Park, 9301 Westminster Blvd., Garden Grove, CA 92844, USA";
const ALLOWED_ORIGIN = "https://ggpogo.com";
const TIMEZONE = "America/Los_Angeles";
const MANAGED_TAG = "ggpogo-calendar-sync";
const LOOKAHEAD_DAYS = 120;
const FIREBASE_DB_URL = "https://ggpogo-tools-us-default-rtdb.firebaseio.com";

// Bump with every meaningfully different delivery of this file, same
// spirit as event-tools.html's APP_VERSION - there is no on-page
// footer to check here, but a version string in the top-of-file
// comment and in this constant at least gives a stable answer to
// "which copy of the worker is this" when comparing against what's
// pasted into Cloudflare.
const WORKER_VERSION = "v1.1.0";

// Title must contain one of these (case-insensitive) to be in scope.
// This is the fallback used only if `settings:calendarSync` in
// Firebase can't be read - see fetchCalendarSyncSettings().
const DEFAULT_INCLUDE_KEYWORDS = [
  "raid hour",
  "community day",
  "raid day",
  "max battle day",
  "go fest",
  "go tour",
  "go wild",
  "finale",
];

// Fallback cross-check source toggles, same rule as above.
const DEFAULT_CROSS_CHECK_SOURCES = { dittobase: true, goHub: true };

// ─────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsPreflight();
    if (request.method !== "POST") {
      return jsonResponse({ error: "Use POST" }, 405);
    }

    const providedKey = request.headers.get("X-Sync-Key");
    if (!env.SYNC_TRIGGER_KEY || providedKey !== env.SYNC_TRIGGER_KEY) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    try {
      const result = await runSync(env);
      return jsonResponse(result, 200);
    } catch (err) {
      return jsonResponse({ error: "Sync failed", detail: String(err && err.stack || err) }, 500);
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Orchestration
// ─────────────────────────────────────────────────────────────
async function runSync(env) {
  const crossCheckIssues = [];
  const syncSettings = await fetchCalendarSyncSettings();

  const leekDuckEvents = await fetchLeekDuckEvents();
  const candidates = leekDuckEvents
    .filter((e) => e.title && isInScope(e.title, syncSettings.inclusionKeywords))
    .map(normalizeCandidate)
    .filter((c) => c.startISO); // must have a usable start time

  // For the event types with a consistently-structured detail page
  // (Raid Hour, Raid Day, Max Battle Day, Community Day), fetch that
  // page's own one-paragraph summary to use in place of the generic
  // lead line. Best-effort and isolated per-event - a failure here
  // just means that one event keeps its generic lead line, it never
  // blocks the run. Run in parallel since it's one extra fetch per
  // qualifying event.
  await Promise.all(
    candidates.filter((c) => shouldFetchDetail(c.title)).map(async (c) => {
      try {
        const summary = await fetchEventDetail(c.sourceUrl);
        if (summary) {
          c.detailSummary = summary;
          c.attackBoostHint = buildAttackBoostHint(summary);
        }
      } catch (err) {
        crossCheckIssues.push(`Could not fetch event detail for "${c.title}": ${err.message || err}`);
      }
    })
  );

  // The universal catch-bonus tip runs on EVERY in-scope candidate, not
  // just the four types above, since the underlying mechanic (an active
  // Mega boosting Catch Candy/Candy XL/Catch XP for type-matching
  // catches) isn't limited to raids at all. A cache is shared across
  // this whole run so that, say, a Legendary trio Raid Hour that recurs
  // weekly for months only triggers one real species lookup instead of
  // one per occurrence - keeps this well under Cloudflare's outbound
  // subrequest limit per run.
  const pokeApiTypeCache = new Map();
  await Promise.all(
    candidates.map(async (c) => {
      try {
        c.catchBonusHint = await buildCatchBonusHint(c, pokeApiTypeCache);
      } catch (err) {
        crossCheckIssues.push(`Could not build catch-bonus tip for "${c.title}": ${err.message || err}`);
      }
    })
  );

  // Best-effort cross-checks - never let these break the run. Each one
  // only runs at all if enabled in settings:calendarSync (both default
  // to on - see DEFAULT_CROSS_CHECK_SOURCES).
  if (syncSettings.crossCheckSources.dittobase) {
    try {
      const dittobaseEvents = await fetchDittobaseEvents();
      crossCheckAgainst(candidates, dittobaseEvents, "Dittobase", crossCheckIssues);
    } catch (err) {
      crossCheckIssues.push(`Dittobase cross-check skipped this run: ${err.message || err}`);
    }
  }

  if (syncSettings.crossCheckSources.goHub) {
    try {
      const goHubEvents = await fetchGoHubEvents();
      crossCheckAgainst(candidates, goHubEvents, "GO Hub", crossCheckIssues);
    } catch (err) {
      crossCheckIssues.push(`GO Hub cross-check skipped this run: ${err.message || err}`);
    }
  }

  const token = await getGoogleAccessToken(env);

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000).toISOString();
  const existingManaged = await listManagedEvents(token, timeMin, timeMax);

  const existingByKey = new Map();
  for (const ev of existingManaged) {
    const key = ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.syncKey;
    if (key) existingByKey.set(key, ev);
  }

  const added = [];
  const updated = [];
  const unchanged = [];
  const errors = [];
  const seenKeys = new Set();

  for (const candidate of candidates) {
    // Each event is isolated - one bad candidate (a parsing quirk, an
    // API rejection) must not block every other event in this run.
    try {
      const syncKey = buildSyncKey(candidate);
      seenKeys.add(syncKey);
      const eventBody = buildEventBody(candidate, syncKey, syncSettings.defaultLocation);
      const existing = existingByKey.get(syncKey);

      if (!existing) {
        const created = await insertEvent(token, eventBody);
        added.push({ title: candidate.title, start: candidate.startISO, calendarLink: created.htmlLink });
        continue;
      }

      if (needsUpdate(existing, eventBody)) {
        const patched = await patchEvent(token, existing.id, eventBody);
        updated.push({ title: candidate.title, start: candidate.startISO, calendarLink: patched.htmlLink });
      } else {
        unchanged.push({ title: candidate.title, start: candidate.startISO });
      }
    } catch (err) {
      errors.push({ title: candidate.title, start: candidate.startISO, detail: String(err && err.message || err) });
    }
  }

  // Anything we created before that no longer shows up on Leek Duck
  // at all - flag for manual review, never auto-delete.
  const flagged = [];
  for (const [key, ev] of existingByKey.entries()) {
    if (!seenKeys.has(key)) {
      flagged.push({
        title: ev.summary,
        start: ev.start && (ev.start.dateTime || ev.start.date),
        calendarLink: ev.htmlLink,
        reason: "No longer found on Leek Duck, verify before deleting manually.",
      });
    }
  }

  const result = {
    ranAt: new Date().toISOString(),
    scanned: leekDuckEvents.length,
    inScope: candidates.length,
    added,
    updated,
    unchanged: unchanged.length,
    errors,
    flagged,
    crossCheckIssues,
    settingsUsed: syncSettings,
  };

  // Best-effort - a Firebase write failure here must never undo or hide
  // the fact that the actual calendar sync above already completed.
  await writeCalendarSyncRun(result);

  return result;
}

// ─────────────────────────────────────────────────────────────
// Firebase-backed settings and run history
// ─────────────────────────────────────────────────────────────

// Reads settings:calendarSync (public read, matching this project's
// other settings:* paths) so a host can adjust inclusion keywords,
// cross-check sources, and the default location from the Calendar
// Sync panel without a new Worker deployment. Any failure (network
// error, malformed JSON, missing path) falls back to this file's own
// hardcoded defaults rather than ever blocking a sync.
async function fetchCalendarSyncSettings() {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/settings:calendarSync.json`);
    if (!res.ok) throw new Error("Firebase settings fetch failed: HTTP " + res.status);
    const raw = await res.json();

    const inclusionKeywords =
      raw && Array.isArray(raw.inclusionKeywords) && raw.inclusionKeywords.length
        ? raw.inclusionKeywords
        : DEFAULT_INCLUDE_KEYWORDS;

    const crossCheckSources =
      raw && raw.crossCheckSources
        ? { ...DEFAULT_CROSS_CHECK_SOURCES, ...raw.crossCheckSources }
        : DEFAULT_CROSS_CHECK_SOURCES;

    const defaultLocation =
      raw && typeof raw.defaultLocation === "string" && raw.defaultLocation.trim()
        ? raw.defaultLocation
        : DEFAULT_LOCATION;

    return { inclusionKeywords, crossCheckSources, defaultLocation };
  } catch (err) {
    return {
      inclusionKeywords: DEFAULT_INCLUDE_KEYWORDS,
      crossCheckSources: DEFAULT_CROSS_CHECK_SOURCES,
      defaultLocation: DEFAULT_LOCATION,
    };
  }
}

// Writes this run's full result to calendarSync:lastRun (overwritten
// each time, for "what happened most recently") and appends it to
// calendarSync:runs (push key, for history). Both paths currently
// allow public writes in firebase-database-rules.json since this
// Worker has no Firebase Auth identity - see the top-of-file note.
// Never throws past the caller.
async function writeCalendarSyncRun(result) {
  try {
    await fetch(`${FIREBASE_DB_URL}/calendarSync:lastRun.json`, {
      method: "PUT",
      body: JSON.stringify(result),
    });
  } catch (err) {
    // Swallowed - see function comment.
  }

  try {
    await fetch(`${FIREBASE_DB_URL}/calendarSync:runs.json`, {
      method: "POST",
      body: JSON.stringify(result),
    });
  } catch (err) {
    // Swallowed - see function comment.
  }
}

// ─────────────────────────────────────────────────────────────
// Scope filtering + candidate shaping
// ─────────────────────────────────────────────────────────────
function isInScope(title, inclusionKeywords) {
  const t = title.toLowerCase();
  const keywords = inclusionKeywords || DEFAULT_INCLUDE_KEYWORDS;
  return keywords.some((kw) => t.includes(kw.toLowerCase()));
}

function normalizeCandidate(raw) {
  return {
    title: raw.title.trim(),
    type: raw.type || "event",
    startISO: normalizeTimestamp(raw.startISO),
    endISO: normalizeTimestamp(raw.endISO) || null,
    sourceUrl: raw.href || "https://leekduck.com/events/",
    // Filled in later, best-effort, for Raid Hour/Day, Max Battle Day,
    // and Community Day only. See shouldFetchDetail()/fetchEventDetail().
    detailSummary: null,
    // In-raid attack-boost tip, only set when the event's own text
    // names a specific Mega raid boss. See buildAttackBoostHint().
    attackBoostHint: null,
    // Universal catch-bonus tip, set for every candidate regardless of
    // event type. See buildCatchBonusHint().
    catchBonusHint: null,
  };
}

// Only these event types have a Leek Duck detail page with a
// consistent, single-paragraph ".event-description" summary worth
// pulling in. GO Fest/Tour/Wild/Finale pages are long-form prose
// instead, which is harder to summarize reliably, so those keep the
// generic lead line from leadLineForType().
function shouldFetchDetail(title) {
  const t = title.toLowerCase();
  return (
    t.includes("raid hour") ||
    t.includes("raid day") ||
    t.includes("max battle day") ||
    t.includes("community day")
  );
}

// Fetches one event's own detail page and pulls out Leek Duck's own
// one-paragraph summary (the text in ".event-description p"), e.g.
// "A Raid Hour featuring Regirock, Regice, and Registeel is scheduled
// from 6 to 7 pm Local Time." Returns null (never throws past the
// caller) if the page structure doesn't match what's expected, so a
// change on Leek Duck's end just means this falls back to the generic
// lead line rather than breaking the run.
async function fetchEventDetail(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GGPoGoCalendarSync/1.0)" },
  });
  if (!res.ok) throw new Error("Event detail fetch failed: HTTP " + res.status);

  let summary = "";
  const rewriter = new HTMLRewriter().on(".event-description p", {
    text(chunk) {
      summary += chunk.text;
    },
  });
  const transformed = rewriter.transform(res);
  await transformed.arrayBuffer();

  summary = summary.replace(/\s+/g, " ").trim();
  return summary || null;
}

// A compact type table for Pokemon GO's Mega-capable species. This is
// the trusted, hand-maintained list of Megas actually confirmed
// available (species known as of Aug 2026 include the newer "Super
// Mega" roster: Victreebel, Malamar, Dragonite, Skarmory, Raichu,
// Falinks, Starmie, Mewtwo X & Y, alongside the long-running roster).
// Used two ways: (1) to turn "...featuring Mega Charizard Y..." in a
// detail summary into a heads-up about the in-raid attack-boost bonus
// (see buildAttackBoostHint()), and (2) as the first, preferred lookup
// for the universal catch-bonus tip (see buildCatchBonusHint()) so that
// tip only ever recommends a Mega actually confirmed available, rather
// than something from a broader external type database that might not
// be released yet. Not necessarily exhaustive - if a name isn't in
// this table it just falls through to the PokeAPI lookup or is skipped,
// rather than guessed at.
const MEGA_TYPES = {
  venusaur: "Grass/Poison",
  victreebel: "Grass/Poison",
  malamar: "Dark/Psychic",
  dragonite: "Dragon/Flying",
  skarmory: "Steel/Flying",
  raichu: "Electric",
  "raichu-x": "Electric",
  "raichu-y": "Electric",
  falinks: "Fighting",
  starmie: "Water/Psychic",
  "charizard-x": "Fire/Dragon",
  "charizard-y": "Fire/Flying",
  blastoise: "Water",
  beedrill: "Bug/Poison",
  pidgeot: "Normal/Flying",
  alakazam: "Psychic",
  slowbro: "Water/Psychic",
  gengar: "Ghost/Poison",
  kangaskhan: "Normal",
  pinsir: "Bug/Flying",
  gyarados: "Water/Dark",
  aerodactyl: "Rock/Flying",
  "mewtwo-x": "Psychic/Fighting",
  "mewtwo-y": "Psychic",
  ampharos: "Electric/Dragon",
  steelix: "Steel/Ground",
  scizor: "Bug/Steel",
  heracross: "Bug/Fighting",
  houndoom: "Dark/Fire",
  tyranitar: "Rock/Dark",
  sceptile: "Grass/Dragon",
  blaziken: "Fire/Fighting",
  swampert: "Water/Ground",
  gardevoir: "Psychic/Fairy",
  sableye: "Dark/Ghost",
  mawile: "Steel/Fairy",
  aggron: "Steel",
  medicham: "Fighting/Psychic",
  manectric: "Electric",
  sharpedo: "Water/Dark",
  camerupt: "Fire/Ground",
  altaria: "Dragon/Fairy",
  banette: "Ghost",
  absol: "Dark",
  glalie: "Ice",
  salamence: "Dragon/Flying",
  metagross: "Steel/Psychic",
  latias: "Dragon/Psychic",
  latios: "Dragon/Psychic",
  rayquaza: "Dragon/Flying",
  lopunny: "Normal/Fighting",
  garchomp: "Dragon/Ground",
  lucario: "Fighting/Steel",
  abomasnow: "Grass/Ice",
  gallade: "Psychic/Fighting",
  audino: "Normal/Fairy",
  diancie: "Rock/Fairy",
};

// Returns a single in-raid attack-boost tip when the event's own detail
// summary names a recognized Mega raid boss, or null otherwise. Per
// Niantic's own Help Center ("Using a Mega-Evolved Pokemon"): every
// Trainer's Pokemon gets an attack boost in a raid where a Mega is
// active, plus an additional boost for attacks whose type matches the
// Mega's own type. This is a battle/damage bonus for that raid, NOT a
// multiplier on Mega Energy earned - no exact percentage is published,
// so none is stated here. This is a distinct mechanic from the
// universal catch-bonus tip below, and only applies during that raid
// battle itself, so it stays scoped to events that actually name a
// Mega raid boss rather than firing on every event.
function buildAttackBoostHint(summaryText) {
  if (!summaryText) return null;
  const match = summaryText.match(/Mega\s+([A-Z][a-zA-Z]+)(?:\s+(X|Y))\b|Mega\s+([A-Z][a-zA-Z]+)/);
  if (!match) return null;

  const rawName = match[1] || match[3] || "";
  const baseName = rawName.toLowerCase();
  const variant = match[2] ? match[2].toLowerCase() : null;
  const key = variant ? `${baseName}-${variant}` : baseName;
  const type = MEGA_TYPES[key] || MEGA_TYPES[baseName] || null;
  if (!type) return null;

  const displayName = variant ? `Mega ${rawName} ${match[2]}` : `Mega ${rawName}`;
  return `Tip: an active ${displayName} (${type} type) gives everyone in this raid an extra attack boost for ${type} type moves.`;
}

// ─────────────────────────────────────────────────────────────
// Universal catch-bonus tip
//
// This is deliberately NOT scoped to raids, Mega raids, or "Super Mega"
// labeled events. Per Pokemon GO Hub's Mega Evolution guide and
// Pokemon Blog's coverage of Mega Level bonuses (see chat sources),
// simply having any of your own Mega Pokemon actively evolved gives
// bonus Catch Candy, a chance at Candy XL, and bonus Catch XP for ANY
// Pokemon you catch that shares a type with that Mega, in any context
// (wild encounter, research task reward, raid catch, etc.), and the
// bonus is biggest once that Mega reaches Level 4 (Super Max). So this
// tip is attempted on every single in-scope event, full stop.
// ─────────────────────────────────────────────────────────────

// Generic phrases stripped out of an event's own title before treating
// whatever is left as a possible featured species name or names. Order
// matters here (longest/most specific first) so "super mega raid day"
// gets removed as a whole before the shorter "raid day" would partially
// match and leave a stray "super mega" behind.
const GENERIC_TITLE_TERMS = [
  "super mega raid day",
  "mega raid day",
  "raid hour",
  "raid day",
  "community day classic",
  "community day",
  "max battle day",
  "go fest",
  "go tour",
  "go wild",
  "mega finale",
  "finale",
  "ultra unlock",
  "pokemon go",
  "classic",
];

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
];

// Leek Duck's event titles usually bake the featured species right in
// once it's announced (e.g. "Skarmory Super Mega Raid Day", "Nickit
// Community Day", "Regirock, Regice, and Registeel Raid Hour"), and
// fall back to a generic placeholder title when it isn't announced yet
// (e.g. "Max Battle Day", "September Community Day Classic"). Stripping
// the known generic words out and seeing what's left is a simple, and
// in practice reliable, way to recover the announced species, without
// needing to parse Leek Duck's much less consistent prose summaries
// (which vary a lot: "featuring X", "X, the Y Pokemon, will be
// featured", "Mega X stars in", "Stay sharp for X", etc.).
function extractNameCandidatesFromTitle(title) {
  let t = title;
  for (const term of GENERIC_TITLE_TERMS) {
    t = t.replace(new RegExp(term, "gi"), " ");
  }
  for (const month of MONTH_NAMES) {
    t = t.replace(new RegExp(`\\b${month}\\b`, "gi"), " ");
  }
  t = t.replace(/\b(19|20)\d{2}\b/g, " ");
  t = t.replace(/[:!]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (!t) return [];

  return t
    .split(/,|\band\b|&/i)
    .map((s) => s.trim())
    .filter((s) => s && /^[A-Z]/.test(s));
}

// A secondary, best-effort pass over the scraped detail-page summary
// (only available for Raid Hour/Day, Max Battle Day, Community Day -
// see fetchEventDetail()), for the handful of common phrasings actually
// seen on Leek Duck. Purely additive to the title-based extraction
// above; a miss here just means we rely on the title alone.
function extractNameCandidatesFromSummary(summaryText) {
  if (!summaryText) return [];
  const patterns = [
    /featuring\s+(.+?)(?:\s+is scheduled|\.|$)/i,
    /^([A-Z][a-zA-Z]+)\s*,\s*the\s+.+?Pok[ée]mon,\s*will be featured/i,
    /^(Mega\s+[A-Z][a-zA-Z]+(?:\s+(?:X|Y))?)\s+stars in/i,
  ];
  for (const pattern of patterns) {
    const match = summaryText.match(pattern);
    if (match) {
      return match[1]
        .split(/,|\band\b|&/i)
        .map((s) => s.trim())
        .filter((s) => s && /^[A-Z]/.test(s));
    }
  }
  return [];
}

function extractFeaturedNames(candidate) {
  const combined = [
    ...extractNameCandidatesFromTitle(candidate.title),
    ...extractNameCandidatesFromSummary(candidate.detailSummary),
  ];

  // Dedup by species identity, not exact string: the title might name a
  // boss plainly ("Starmie") while the summary names it as a Mega
  // ("Mega Starmie") - both refer to the same underlying species, so
  // stripping a leading "Mega " before comparing keeps that from being
  // counted (and covered) as two separate bosses.
  const seen = new Set();
  const result = [];
  for (const name of combined) {
    const key = name.toLowerCase().replace(/^mega\s+/, "");
    if (!seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  }
  return result;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function normalizePokeApiSlug(name) {
  return name
    .toLowerCase()
    .replace(/♀/g, "-f")
    .replace(/♂/g, "-m")
    .replace(/[.']/g, "")
    .replace(/\s+/g, "-");
}

async function fetchPokeApiTypes(slug, cache) {
  if (cache.has(slug)) return cache.get(slug);
  let types = [];
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    if (res.ok) {
      const json = await res.json();
      types = (json.types || []).map((t) => capitalize(t.type.name));
    }
  } catch (_e) {
    types = [];
  }
  cache.set(slug, types);
  return types;
}

// If `name` is itself a confirmed Mega (checked against MEGA_TYPES,
// variant-specific key first), returns that table key. Returns null for
// anything not itself a confirmed Mega (most commonly a non-Mega-capable
// raid boss like a Legendary, or a brand new Mega not in the table yet).
function megaKeyIfConfirmed(name) {
  const megaMatch = name.match(/^Mega\s+([A-Za-z]+)(?:\s+(X|Y))?$/i);
  if (megaMatch) {
    const base = megaMatch[1].toLowerCase();
    const variant = megaMatch[2] ? megaMatch[2].toLowerCase() : null;
    const key = variant ? `${base}-${variant}` : base;
    if (MEGA_TYPES[key]) return key;
    if (MEGA_TYPES[base]) return base;
    return null;
  }
  const plainKey = name.toLowerCase();
  return MEGA_TYPES[plainKey] ? plainKey : null;
}

// Resolves one featured name to its real elemental type(s) - the set a
// catch of that Pokemon needs ANY ONE match against to earn the catch
// bonus. Checked against MEGA_TYPES first (the more trustworthy,
// hand-confirmed source); falls back to PokeAPI (a free public Pokemon
// database) for anything not itself a confirmed Mega. Returns an empty
// array, never throws, when a name can't be resolved either way.
async function resolveBossTypes(name, cache) {
  const key = megaKeyIfConfirmed(name);
  if (key) return MEGA_TYPES[key].split("/");

  const megaMatch = name.match(/^Mega\s+([A-Za-z]+)(?:\s+(X|Y))?$/i);
  if (megaMatch) {
    const base = megaMatch[1].toLowerCase();
    const variant = megaMatch[2] ? megaMatch[2].toLowerCase() : null;
    return fetchPokeApiTypes(variant ? `${base}-mega-${variant}` : `${base}-mega`, cache);
  }
  return fetchPokeApiTypes(normalizePokeApiSlug(name), cache);
}

function formatMegaDisplayName(key) {
  const variantMatch = key.match(/^(.+)-(x|y)$/);
  if (variantMatch) {
    return `Mega ${capitalize(variantMatch[1])} ${variantMatch[2].toUpperCase()}`;
  }
  return `Mega ${capitalize(key)}`;
}

const GENERIC_CATCH_BONUS_TIP =
  "Tip: keeping any of your own Mega Pokemon active gives bonus Catch Candy, a chance at Candy XL, and bonus Catch XP for any Pokemon you catch that shares its type, with the biggest boost at Mega Level 4 (Super Max).";

// Greedy minimum set cover: repeatedly picks whichever confirmed Mega
// (from MEGA_TYPES) covers the most still-uncovered bosses - a boss
// counts as covered once ANY ONE of its own types matches ANY ONE of
// the chosen Mega's types - stopping once every boss is covered or no
// remaining candidate covers anything left (e.g. a lookup failure left
// a boss with no types at all). This is what lets one dual-type Mega
// (say, a Ground/Dragon Mega covering both a Ground-type boss and a
// separate Dragon-type boss) collapse down to a single recommendation
// instead of one-per-boss, matching the "as few Megas as possible when
// a type combo applies to everyone" request; when no such overlap
// exists (e.g. three completely different single-typed Legendary
// bosses) it naturally falls back to one recommendation per boss. Ties
// in coverage count prefer whichever candidate is itself one of the
// actual featured bosses (`featuredMegaKeys`), so a Super Mega Raid's
// own boss is recommended over an arbitrary unrelated substitute when
// both would technically work equally well.
function chooseMegaCoverSet(bosses, featuredMegaKeys) {
  const uncovered = new Set(bosses.map((_, i) => i));
  const recommendations = [];

  while (uncovered.size > 0) {
    let bestKey = null;
    let bestCoveredIndices = [];
    let bestIsFeatured = false;

    for (const [key, typesStr] of Object.entries(MEGA_TYPES)) {
      const candidateTypes = typesStr.split("/");
      const coveredIndices = [];
      for (const i of uncovered) {
        if (bosses[i].types.some((t) => candidateTypes.includes(t))) coveredIndices.push(i);
      }
      if (coveredIndices.length === 0) continue;

      const isFeatured = featuredMegaKeys.has(key);
      const better =
        coveredIndices.length > bestCoveredIndices.length ||
        (coveredIndices.length === bestCoveredIndices.length && isFeatured && !bestIsFeatured);

      if (better) {
        bestKey = key;
        bestCoveredIndices = coveredIndices;
        bestIsFeatured = isFeatured;
      }
    }

    if (!bestKey) break; // nothing left can be covered - stop rather than loop forever

    const candidateTypes = MEGA_TYPES[bestKey].split("/");
    const relevantTypes = candidateTypes.filter((t) => bestCoveredIndices.some((i) => bosses[i].types.includes(t)));
    recommendations.push({ label: formatMegaDisplayName(bestKey), types: relevantTypes });
    bestCoveredIndices.forEach((i) => uncovered.delete(i));
  }

  return recommendations;
}

function joinWithOr(items) {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function formatCatchBonusTip(recommendations) {
  const megaList = joinWithOr(recommendations.map((r) => `${r.label} (${r.types.join("/")} type)`));
  const typeList = joinWithOr(recommendations.map((r) => r.types.join("/")));
  return `Tip: keeping ${megaList} active gives bonus Catch Candy, a chance at Candy XL, and bonus Catch XP when catching ${typeList} type Pokemon here, with the biggest boost at Mega Level 4 (Super Max).`;
}

// Builds the universal catch-bonus tip for one candidate. Resolves
// EVERY featured boss/species (not capped at some fixed count), then
// picks the smallest set of confirmed Megas that covers all of them
// (see chooseMegaCoverSet()). Falls back to fully generic wording when
// nothing specific can be identified at all (a placeholder event page
// that hasn't announced its species yet, a global multi-day event with
// no single catchable species, an extraction miss, etc.), or when every
// featured name failed to resolve to a real type. Never throws past
// the caller.
async function buildCatchBonusHint(candidate, cache) {
  const names = extractFeaturedNames(candidate);

  const featuredMegaKeys = new Set();
  const bosses = [];
  for (const name of names) {
    const key = megaKeyIfConfirmed(name);
    if (key) featuredMegaKeys.add(key);

    const types = await resolveBossTypes(name, cache);
    if (types.length) bosses.push({ name, types });
  }

  if (bosses.length === 0) return GENERIC_CATCH_BONUS_TIP;

  const recommendations = chooseMegaCoverSet(bosses, featuredMegaKeys);
  if (recommendations.length === 0) return GENERIC_CATCH_BONUS_TIP;

  return formatCatchBonusTip(recommendations);
}

function normalizeTimestamp(value) {
  if (!value) return null;
  // Leek Duck gives two different flavors of timestamp:
  //   - Fixed-instant events (e.g. GO Battle League season changes) carry
  //     an explicit offset/Z - the same moment for everyone worldwide.
  //     Passed through unchanged; Google Calendar honors the offset as-is.
  //   - "Local time" events (Raid Hour, Community Day, Raid Day, Max
  //     Battle Day, GO Fest/Tour/Wild/Finale) give bare numbers that are
  //     literally "6:00 PM local" with no timezone math applied. Passed
  //     through unchanged too - paired with timeZone: "America/Los_Angeles"
  //     in the Calendar API body, Google interprets the bare string in
  //     that zone, which is exactly what we want for a Pacific-based
  //     community.
  // Either way: no transformation needed, just pass the raw value through.
  return value.trim();
}

function buildSyncKey(candidate) {
  const dateStr = candidate.startISO.slice(0, 10); // YYYY-MM-DD (UTC date)
  const slug = candidate.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${candidate.type}|${slug}|${dateStr}`;
}

// ─────────────────────────────────────────────────────────────
// Leek Duck - authoritative source
// ─────────────────────────────────────────────────────────────
async function fetchLeekDuckEvents() {
  const res = await fetch("https://leekduck.com/events/", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GGPoGoCalendarSync/1.0)" },
  });
  if (!res.ok) throw new Error("Leek Duck fetch failed: HTTP " + res.status);

  const events = [];
  let current = null;

  const rewriter = new HTMLRewriter()
    .on("span.event-header-item-wrapper", {
      element(el) {
        const type = el.getAttribute("data-event-type");
        if (!type) {
          current = null;
          return;
        }
        current = {
          type,
          // Leek Duck's own stable identifier for this specific
          // occurrence, when present. Used below to merge duplicate
          // cards for the same event (see mergeDuplicateOccurrences()).
          occurrenceId: el.getAttribute("data-event-occurrence-id") || null,
          // Leek Duck has used two attribute names for the start time.
          // As of Aug 2026 the live markup dropped plain
          // "data-event-start-date" for recurring/tentpole event types
          // (Raid Hour, Community Day, GO Fest, etc.) in favor of
          // "data-event-start-date-check", while a smaller set of other
          // event types still carry the plain attribute. Check both so
          // a future rename on either side doesn't silently zero out
          // every candidate.
          startISO:
            el.getAttribute("data-event-start-date-check") ||
            el.getAttribute("data-event-start-date") ||
            null,
          endISO: el.getAttribute("data-event-end-date") || null,
          href: null,
          title: "",
        };
        events.push(current);
      },
    })
    .on("span.event-header-item-wrapper a.event-item-link", {
      element(el) {
        if (!current) return;
        const href = el.getAttribute("href");
        if (href) current.href = href.startsWith("http") ? href : "https://leekduck.com" + href;
      },
    })
    .on("span.event-header-item-wrapper h2", {
      text(chunk) {
        if (current) current.title += chunk.text;
      },
    });

  const transformed = rewriter.transform(res);
  await transformed.arrayBuffer(); // drain the stream so handlers actually run

  events.forEach((e) => (e.title = e.title.trim()));
  return mergeDuplicateOccurrences(events);
}

// Leek Duck sometimes renders the same event occurrence in more than
// one card on this page at once (for example a tentpole event can get
// both a highlighted banner card and its normal grid card). The two
// cards do not always carry the same attributes. This was the direct
// cause of a real regression: GO Fest Mega Finale's banner card had
// the correct multi-day "data-event-end-date", but its plain grid card
// had only a start date and no end date at all. Both cards produced
// the same title/type/date, so both became separate candidates with
// the same sync key, and whichever one happened to be processed last
// in that run silently overwrote the other, sometimes replacing a
// correct multi-day event with a bogus 1-hour default.
//
// Fix: merge cards for the same occurrence into one record instead of
// treating them as independent candidates, preferring Leek Duck's own
// "data-event-occurrence-id" as the merge key (falling back to
// type+title+date for the rare card that omits it), and filling in
// whichever fields are missing from whichever card actually has them.
function mergeDuplicateOccurrences(events) {
  const merged = new Map();
  const order = [];

  for (const e of events) {
    const key = e.occurrenceId || `${e.type}|${e.title}|${(e.startISO || "").slice(0, 10)}`;
    if (!merged.has(key)) {
      merged.set(key, { ...e });
      order.push(key);
      continue;
    }
    const existing = merged.get(key);
    existing.startISO = existing.startISO || e.startISO;
    existing.endISO = existing.endISO || e.endISO;
    existing.href = existing.href || e.href;
    existing.title = existing.title || e.title;
  }

  return order.map((k) => merged.get(k));
}

// ─────────────────────────────────────────────────────────────
// Dittobase - cross-check only, best effort
// ─────────────────────────────────────────────────────────────
async function fetchDittobaseEvents() {
  const res = await fetch("https://www.dittobase.com/pokemon-go/events", {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GGPoGoCalendarSync/1.0)" },
  });
  if (!res.ok) throw new Error("Dittobase fetch failed: HTTP " + res.status);

  const items = [];
  let currentText = "";

  const rewriter = new HTMLRewriter().on('a[href*="/pokemon-go/events/"]', {
    element(el) {
      currentText = "";
      const href = el.getAttribute("href");
      items.push({ href, title: "" });
      this._active = items[items.length - 1];
    },
    text(chunk) {
      if (items.length) items[items.length - 1].title += chunk.text;
    },
  });

  const transformed = rewriter.transform(res);
  await transformed.arrayBuffer();

  return items
    .map((i) => ({ title: (i.title || "").replace(/\s+/g, " ").trim() }))
    .filter((i) => i.title && !/^events?$/i.test(i.title));
}

// ─────────────────────────────────────────────────────────────
// GO Hub - cross-check only, best effort
// Monthly post URL pattern: pokemon-go-{month}-{year}-events
// ─────────────────────────────────────────────────────────────
async function fetchGoHubEvents() {
  const now = new Date();
  const slugs = [monthSlug(now), monthSlug(new Date(now.getFullYear(), now.getMonth() + 1, 1))];

  let text = "";
  let fetchedAny = false;
  for (const slug of slugs) {
    try {
      const res = await fetch(`https://pokemongohub.net/post/event/${slug}/`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; GGPoGoCalendarSync/1.0)" },
      });
      if (!res.ok) continue;
      text += " " + (await res.text());
      fetchedAny = true;
    } catch (_e) {
      // ignore, best-effort
    }
  }
  if (!fetchedAny) throw new Error("Could not reach GO Hub monthly events post");

  // Prose page - we only check for keyword presence as a loose signal,
  // not structured extraction. Uses the fallback keyword list rather
  // than the run's configured settings, since this is just a coarse
  // "does GO Hub mention this at all" signal for crossCheckAgainst(),
  // not itself a source of scope decisions.
  const lower = text.toLowerCase();
  return DEFAULT_INCLUDE_KEYWORDS.filter((kw) => lower.includes(kw)).map((kw) => ({ title: kw }));
}

function monthSlug(date) {
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  return `pokemon-go-${months[date.getMonth()]}-${date.getFullYear()}-events`;
}

function crossCheckAgainst(candidates, otherEvents, sourceName, issues) {
  if (!otherEvents || !otherEvents.length) {
    issues.push(`${sourceName} returned no events to compare this run.`);
    return;
  }
  const otherTitles = otherEvents.map((e) => (e.title || "").toLowerCase());
  for (const candidate of candidates) {
    const t = candidate.title.toLowerCase();
    const hasLooseMatch = otherTitles.some((ot) => ot && (t.includes(ot) || ot.includes(t)));
    if (!hasLooseMatch) {
      issues.push(`"${candidate.title}" (from Leek Duck) has no obvious match on ${sourceName}, worth a manual glance.`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Description templating (kept intentionally simple - see notes)
// ─────────────────────────────────────────────────────────────
function buildEventBody(candidate, syncKey, location) {
  const description = buildDescription(candidate);

  const body = {
    summary: candidate.title,
    description,
    location: location || DEFAULT_LOCATION,
    extendedProperties: {
      private: {
        managedBy: MANAGED_TAG,
        syncKey,
      },
    },
  };

  if (candidate.endISO) {
    body.start = { dateTime: candidate.startISO, timeZone: TIMEZONE };
    body.end = { dateTime: candidate.endISO, timeZone: TIMEZONE };
  } else {
    // Default 1-hour block when no end time is available. Must stay in
    // the same "frame" as startISO (bare-local vs offset-qualified) -
    // see addHours() below for why this can't just use plain Date math.
    body.start = { dateTime: candidate.startISO, timeZone: TIMEZONE };
    body.end = { dateTime: addHours(candidate.startISO, 1), timeZone: TIMEZONE };
  }

  return body;
}

// Adds `hours` to a timestamp that may or may not carry an offset/Z,
// preserving whichever form it started in. A bare "local" string like
// "2026-09-05T10:00:00" must NOT be run through plain `new Date(...)`
// arithmetic - the Worker runtime treats a bare string as UTC, which
// silently shifts the wall-clock hour and can even flip start/end order
// once Google re-applies the real Pacific offset. Doing the arithmetic
// against a temporary UTC anchor and then stripping the "Z" back off
// keeps the wall-clock numbers themselves the only thing that changes.
function addHours(value, hours) {
  const hasOffset = /[zZ]$|[+-]\d{2}:\d{2}$/.test(value);
  if (hasOffset) {
    return new Date(new Date(value).getTime() + hours * 3600000).toISOString();
  }
  const asUtcAnchor = new Date(value + "Z");
  const shifted = new Date(asUtcAnchor.getTime() + hours * 3600000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, "");
}

function leadLineForType(type, title) {
  if (type.includes("go-fest") || type.includes("go-tour") || type.includes("go-wild")) {
    return `Garden Grove PoGo is marking ${title}. This is the global event window, not a ticketed in-person event.`;
  }
  if (type.includes("community-day")) {
    return `Join Garden Grove PoGo for ${title}! Bring your best Poké Balls and berries.`;
  }
  return `Join Garden Grove PoGo for ${title}.`;
}

// No time line here on purpose: the calendar event itself already
// shows the correct start/end (converted to whatever timezone the
// viewer's Google account uses), so repeating it as text would just
// be redundant and another place a formatting bug could hide.
function buildDescription(candidate) {
  const lines = [];

  lines.push(candidate.detailSummary || leadLineForType(candidate.type, candidate.title));
  if (candidate.attackBoostHint) lines.push(candidate.attackBoostHint);
  if (candidate.catchBonusHint) lines.push(candidate.catchBonusHint);

  lines.push("");
  lines.push(`Full details: ${candidate.sourceUrl}`);
  lines.push("");
  lines.push(
    "Arrive a little early if you want to coordinate teams or trades. Be aware of your surroundings, respect local spaces, and check Campfire or the in-game map for real-time updates."
  );

  return lines.join("\n");
}

function needsUpdate(existingEvent, newBody) {
  // Compare actual moments in time, not raw strings - Google echoes
  // dateTime back reformatted with its own offset notation, which would
  // never string-match our locally-built value even when unchanged.
  const existingStartMs = toEpochMs(existingEvent.start && existingEvent.start.dateTime);
  const existingEndMs = toEpochMs(existingEvent.end && existingEvent.end.dateTime);
  const newStartMs = toEpochMs(newBody.start.dateTime);
  const newEndMs = toEpochMs(newBody.end.dateTime);

  if (existingStartMs !== newStartMs) return true;
  if (existingEndMs !== newEndMs) return true;
  if ((existingEvent.description || "") !== newBody.description) return true;
  if ((existingEvent.location || "") !== newBody.location) return true;
  return false;
}

// Parses a dateTime string to epoch ms. If it has no offset/Z, it's a
// bare "local time" string - approximate by treating it as Pacific
// (good enough for equality comparison purposes here).
function toEpochMs(dateTimeStr) {
  if (!dateTimeStr) return null;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(dateTimeStr)) {
    return new Date(dateTimeStr).getTime();
  }
  // Bare local string - append a fixed Pacific offset approximation.
  // This is only used for change-detection, not for the actual write,
  // so exact DST precision isn't critical here.
  return new Date(dateTimeStr + "-07:00").getTime();
}

// ─────────────────────────────────────────────────────────────
// Google Calendar API (service-account JWT auth)
// ─────────────────────────────────────────────────────────────
async function getGoogleAccessToken(env) {
  const key = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const nowSec = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: key.token_uri,
    iat: nowSec,
    exp: nowSec + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const pemBody = key.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const derBuffer = base64ToArrayBuffer(pemBody);

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    derBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64urlFromBuffer(signature)}`;

  const tokenRes = await fetch(key.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=" +
      encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") +
      "&assertion=" +
      jwt,
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) throw new Error("Google token exchange failed: " + JSON.stringify(tokenJson));
  return tokenJson.access_token;
}

async function listManagedEvents(token, timeMinISO, timeMaxISO) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`
  );
  url.searchParams.set("timeMin", timeMinISO);
  url.searchParams.set("timeMax", timeMaxISO);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("privateExtendedProperty", `managedBy=${MANAGED_TAG}`);

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error("Calendar list failed: " + JSON.stringify(json));
  return json.items || [];
}

async function insertEvent(token, eventBody) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody),
  });
  const json = await res.json();
  if (!res.ok) throw new Error("Calendar insert failed: " + JSON.stringify(json));
  return json;
}

async function patchEvent(token, eventId, eventBody) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(eventBody),
  });
  const json = await res.json();
  if (!res.ok) throw new Error("Calendar patch failed: " + JSON.stringify(json));
  return json;
}

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
function base64url(str) {
  return base64urlFromBuffer(new TextEncoder().encode(str));
}

function base64urlFromBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    },
  });
}

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key",
    },
  });
}