const axios = require('axios');
const fs = require('fs');

const BASE = 'https://app.ticketmaster.com/discovery/v2';
const PAGE_SIZE = 200;
const CACHE_TTL_MS = 8 * 60 * 1000; // 8 minutes

// Simple in-memory cache: key → { data, expiresAt }
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function bustCache() {
  cache.clear();
}

// Priority order for resolving an artist URL from TM attraction data.
const ARTIST_LINK_PRIORITY = ['homepage', 'twitter', 'instagram', 'facebook', 'youtube', 'spotify'];

// Normalize a raw TM event into the shape the frontend expects.
function normalize(event) {
  const dates = event.dates?.start ?? {};
  const venue = event._embedded?.venues?.[0];
  const att   = event._embedded?.attractions?.[0];
  const img =
    event.images?.find(i => i.ratio === '16_9' && i.width >= 640) ??
    event.images?.[0];

  // Resolve artist URL: homepage → social fallback → TM artist page → null
  const ext = att?.externalLinks ?? {};
  let artistUrl = null;
  for (const key of ARTIST_LINK_PRIORITY) {
    if (ext[key]?.[0]?.url) { artistUrl = ext[key][0].url; break; }
  }
  if (!artistUrl && att?.url) artistUrl = att.url;

  return {
    id: event.id,
    name: event.name,
    date: dates.localDate ?? null,
    time: dates.localTime ?? null,
    venueId: venue?.id ?? null,
    venueName: venue?.name ?? null,
    url: event.url ?? null,
    imageUrl: img?.url ?? null,
    artistUrl,
  };
}

// Fetch all pages of events for a list of TM venue IDs within [startDate, endDate].
// Dates are ISO strings like "2026-05-01".
async function fetchEvents(tmIds, startDate, endDate, apiKey) {
  const cacheKey = `${tmIds.join(',')}|${startDate}|${endDate}`;
  const cached = cacheGet(cacheKey);
  if (cached) return { events: cached, fromCache: true };

  const startDT = `${startDate}T00:00:00Z`;
  const endDT = `${endDate}T23:59:59Z`;

  let allEvents = [];

  // TM allows up to 5 venue IDs per request.
  const chunks = chunkArray(tmIds, 5);

  for (let ci = 0; ci < chunks.length; ci++) {
    if (ci > 0) await sleep(400); // stay well inside the free-tier rate limit
    const chunk = chunks[ci];
    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      const { data } = await axios.get(`${BASE}/events.json`, {
        params: {
          venueId: chunk.join(','),
          startDateTime: startDT,
          endDateTime: endDT,
          size: PAGE_SIZE,
          page,
          sort: 'date,asc',
          apikey: apiKey,
        },
      });

      const events = data?._embedded?.events ?? [];
      allEvents = allEvents.concat(events.map(normalize));

      const pageInfo = data?.page ?? {};
      totalPages = pageInfo.totalPages ?? 1;
      page += 1;
    }
  }

  // Deduplicate by event ID (same event can appear across venue chunks).
  const seen = new Set();
  const unique = allEvents.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  unique.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time < b.time ? -1 : 1;
  });

  cacheSet(cacheKey, unique);
  return { events: unique, fromCache: false };
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Persist current in-memory cache entries to a JSON file.
function persistCache(filePath) {
  const entries = {};
  for (const [key, val] of cache.entries()) {
    if (Date.now() < val.expiresAt) entries[key] = val.data;
  }
  fs.writeFileSync(filePath, JSON.stringify({ savedAt: Date.now(), entries }, null, 0));
  return Object.keys(entries).length;
}

// Load a previously persisted cache file into memory (12-hour staleness limit).
function loadPersistedCache(filePath) {
  const STALE_MS = 12 * 60 * 60 * 1000;
  try {
    const stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Date.now() - stored.savedAt > STALE_MS) return 0;
    let count = 0;
    for (const [key, data] of Object.entries(stored.entries)) {
      cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

module.exports = { fetchEvents, bustCache, persistCache, loadPersistedCache };
