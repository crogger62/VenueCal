require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const venues = require('./venues');
const { fetchEvents, bustCache, loadPersistedCache } = require('./ticketmaster');

const CACHE_FILE = path.join(__dirname, 'cache.json');

const API_KEY = process.env.TICKETMASTER_API_KEY;
if (!API_KEY) {
  console.error('ERROR: TICKETMASTER_API_KEY is not set in .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend from /public when we build it out later
app.use(express.static(path.join(__dirname, 'public')));

// ── GET /api/venues ──────────────────────────────────────────────────────────
// Returns the venue list (no TM IDs exposed to the client).
app.get('/api/venues', (_req, res) => {
  res.json(
    venues.map(({ id, name, color, limitedCoverage }) => ({
      id,
      name,
      color,
      limitedCoverage,
    }))
  );
});

// ── GET /api/events ──────────────────────────────────────────────────────────
// Query params:
//   start  — ISO date, e.g. 2026-05-01 (defaults to today)
//   end    — ISO date, e.g. 2026-06-30 (defaults to 90 days out)
//   venues — comma-separated venue ids from /api/venues (defaults to all)
app.get('/api/events', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const ninetyDaysOut = new Date(Date.now() + 90 * 86400_000)
      .toISOString()
      .slice(0, 10);

    const start = req.query.start || today;
    const end = req.query.end || ninetyDaysOut;

    // Validate dates
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return res.status(400).json({ error: 'start and end must be YYYY-MM-DD' });
    }
    if (start > end) {
      return res.status(400).json({ error: 'start must be before or equal to end' });
    }

    // Resolve requested venue IDs
    let targetVenueIds = req.query.venues
      ? req.query.venues.split(',').map(s => s.trim()).filter(Boolean)
      : null;

    let targetVenues = targetVenueIds
      ? venues.filter(v => targetVenueIds.includes(v.id))
      : venues;

    if (!targetVenues.length) {
      return res.status(400).json({ error: 'No matching venues found' });
    }

    const tmIds = targetVenues.map(v => v.tmId);

    const { events, fromCache } = await fetchEvents(tmIds, start, end, API_KEY);

    // Attach our internal venue metadata to each event for the frontend
    const tmIdToVenue = Object.fromEntries(
      venues.flatMap(v => [v.tmId, ...(v.tmAliases ?? [])].map(tmId => [tmId, v]))
    );
    const enriched = events.map(e => {
      const meta = tmIdToVenue[e.venueId] ?? null;
      return {
        ...e,
        venueSlug: meta?.id ?? null,
        venueColor: meta?.color ?? '#888888',
        venueLimitedCoverage: meta?.limitedCoverage ?? false,
      };
    });

    res.json({ events: enriched, fromCache, start, end, count: enriched.length });
  } catch (err) {
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'Ticketmaster rate limit hit — try again in a moment' });
    }
    console.error('Error fetching events:', err.message);
    res.status(500).json({ error: 'Failed to fetch events from Ticketmaster' });
  }
});

// ── POST /api/cache/bust ─────────────────────────────────────────────────────
// Manual cache-clear for the refresh button.
app.post('/api/cache/bust', (_req, res) => {
  bustCache();
  res.json({ ok: true, message: 'Cache cleared' });
});

const PORT = process.env.PORT || 4000;
const prewarm = loadPersistedCache(CACHE_FILE);

app.listen(PORT, () => {
  console.log(`VenueCal running at http://localhost:${PORT}`);
  console.log(`Venues loaded: ${venues.length}`);
  if (prewarm > 0) console.log(`Cache pre-loaded: ${prewarm} entries from cache.json`);
  console.log(`API key: ${API_KEY.slice(0, 6)}...`);
});
