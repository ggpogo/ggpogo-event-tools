// Garden Grove PoGo — Campfire Tools CORS proxy + scheduled stats refresh
//
// Two jobs in one Worker:
//
// 1. CORS PROXY (fetch handler)
//    Topi's Campfire Tools API (https://cmpf-tools.de/api) doesn't send
//    Access-Control-Allow-Origin headers, so browsers block direct fetches
//    to it from other sites. This Worker forwards GET requests to that API
//    and adds the missing CORS header to the response, so the Meetup Stats
//    panel can fetch live data on-demand.
//
//    Usage: https://your-worker.workers.dev/clubs/{club_id}/events
//
// 2. SCHEDULED REFRESH (scheduled handler)
//    A Cloudflare Cron Trigger fires daily at 7 PM Pacific. The handler
//    fetches the Topi API directly (server-to-server, no CORS issue),
//    slims the response to the same shape the app caches, and writes it
//    to Firebase Realtime Database at stats:cache via the REST API.
//
// Required environment variables (set as Worker secrets):
//   FIREBASE_DB_SECRET  — Firebase Realtime Database secret (legacy token)
//   CLUB_ID             — Campfire club UUID (e.g. 37783c12-f35f-488c-8fd1-36ea2b2e4a4d)
//
// Required wrangler.toml cron trigger:
//   [triggers]
//   crons = ["0 2 * * *"]
//   # 2:00 AM UTC = 7:00 PM PDT (6:00 PM PST during standard time)
//   # Adjust to "0 3 * * *" during standard time, or use a timezone-
//   # aware alternative if Cloudflare adds support.

const UPSTREAM_BASE = "https://cmpf-tools.de/api";
const FIREBASE_DB_URL = "https://ggpogo-tools-us-default-rtdb.firebaseio.com";

export default {
  // ─── CORS proxy (existing behavior, unchanged) ───
  async fetch(request) {
    const url = new URL(request.url);

    // Only allow GET requests — this proxy is read-only.
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Forward the path + query string to the Topi API.
    const upstreamUrl = UPSTREAM_BASE + url.pathname + url.search;

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        headers: { "Accept": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Copy the response body through, but add the CORS header so the
    // browser will let our JavaScript read it.
    const body = await upstreamResponse.text();
    return new Response(body, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  },

  // ─── Scheduled stats refresh (new) ───
  async scheduled(event, env, ctx) {
    const clubId = env.CLUB_ID;
    const dbSecret = env.FIREBASE_DB_SECRET;

    if (!clubId || !dbSecret) {
      console.error("Scheduled refresh skipped: CLUB_ID or FIREBASE_DB_SECRET not set.");
      return;
    }

    // 1. Fetch the Topi API
    const apiUrl = `${UPSTREAM_BASE}/clubs/${clubId}/events`;
    let data;
    try {
      const res = await fetch(apiUrl, {
        headers: { "Accept": "application/json" },
      });
      if (!res.ok) {
        console.error(`Topi API returned HTTP ${res.status}`);
        return;
      }
      data = await res.json();
    } catch (err) {
      console.error("Topi API fetch failed:", err);
      return;
    }

    if (!Array.isArray(data)) {
      console.error("Topi API returned non-array response");
      return;
    }

    // 2. Slim to the same shape as the app's cacheEvents() function:
    //    { events: [{ id, name, time, url, members: [{ id, rsvp_status }] }], fetchedAt }
    const slim = data.map(e => ({
      id: e.id,
      name: e.name,
      time: e.time,
      url: e.url,
      members: (e.members || []).map(m => ({ id: m.id, rsvp_status: m.rsvp_status })),
    }));

    const cachePayload = {
      events: slim,
      fetchedAt: Date.now(),
    };

    // 3. Write to Firebase Realtime Database via REST API
    //    PUT replaces the entire stats:cache node (same as FB.set in the app).
    //    The colon in "stats:cache" must be URL-encoded.
    const firebaseUrl = `${FIREBASE_DB_URL}/stats%3Acache.json?auth=${encodeURIComponent(dbSecret)}`;
    try {
      const putRes = await fetch(firebaseUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cachePayload),
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        console.error(`Firebase PUT failed (HTTP ${putRes.status}): ${errText}`);
        return;
      }
      console.log(`Stats cache refreshed: ${slim.length} events cached at ${new Date().toISOString()}`);
    } catch (err) {
      console.error("Firebase PUT failed:", err);
    }
  },
};
