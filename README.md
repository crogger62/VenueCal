# VenueCal — Denver

A personal music venue calendar for Denver, CO. Pulls event data from the Ticketmaster Discovery API and presents it as a monthly grid calendar and a 90-day agenda list.

---

![VenueCal Calendar View](<VenueCal - Calendar View.png>)

![VenueCal Agenda View](<VenueCal - Agenda View.png>)

## Venues

| Venue | Coverage |
|---|---|
| Red Rocks Amphitheatre | Full |
| Mission Ballroom | Full |
| Fillmore Auditorium | Full |
| Ogden Theatre | Full |
| Gothic Theatre | Full |
| Marquis Theater | Full |
| Bluebird Theater | Full |
| Summit Music Hall | Full |

---

## Architecture

```
VenueCal/
├── server.js                  Express app — API routes + static file serving
├── venues.js                  Venue config (names, Ticketmaster IDs, badge colors)
├── ticketmaster.js            TM Discovery API client, in-memory cache, file cache I/O
├── cache.json                 Persisted event cache (written by fetch-and-cache, gitignored)
├── public/
│   ├── index.html             Single-page app shell
│   ├── style.css              Dark theme
│   └── app.js                 Vanilla JS — calendar + agenda views
└── scripts/
    ├── fetch-and-cache.js     Pre-warm script — fetches 6 months of events, then starts server
    └── lookup-venues.js       One-off utility to resolve TM venue IDs by name
```

### Data flow

```
Browser → GET /api/events
             ↓
         server.js  (validates params, resolves venue slugs → TM IDs)
             ↓
         ticketmaster.js  (checks in-memory cache → if miss, calls TM API)
             ↓
         Ticketmaster Discovery API  (returns raw event objects)
             ↓
         normalize()  (extracts: id, name, date, time, venueId, url, imageUrl)
             ↓
         enrich()  (attaches: venueSlug, venueColor, venueLimitedCoverage)
             ↓
         JSON response → app.js renders calendar or agenda view
```

### Caching — two layers

**In-memory cache** (`ticketmaster.js`)
- Simple `Map` keyed by `"tmId1,tmId2,...|startDate|endDate"`
- TTL: 8 minutes
- Cleared by the refresh button (`POST /api/cache/bust`)
- Disappears when the server restarts

**File cache** (`cache.json`)
- Written by `scripts/fetch-and-cache.js` after each pre-warm run
- Loaded into memory automatically when the server starts
- Staleness limit: 12 hours — ignored if older
- Covers the current month + next 5 months across all venues
- Gitignored (machine-local, contains dated event data)

On a typical startup via `npm start`:
1. `fetch-and-cache.js` fetches 6 months of events → writes `cache.json`
2. Server starts and reads `cache.json` → in-memory cache is immediately warm
3. First page load hits zero TM API calls

---

## Installation

**Prerequisites:** Node.js ≥ 18

```bash
git clone <repo-url>
cd VenueCal
npm install --no-bin-links
```

> `--no-bin-links` is required because the project lives on an NTFS-mounted drive, which does not support the symlinks npm normally creates in `node_modules/.bin`.

---

## API key

VenueCal uses the [Ticketmaster Discovery API](https://developer.ticketmaster.com). The free tier is sufficient — it provides read access to event and venue data with no usage fees.

### Getting a key

1. Go to [developer.ticketmaster.com](https://developer.ticketmaster.com) and create an account
2. Create an app — select **Public APIs** as the product
3. Copy the **Consumer Key** (this is your API key; ignore the Consumer Secret)

### Storing the key

Create a `.env` file in the project root (copy from the example):

```bash
cp .env.example .env
```

Edit `.env` and paste your key:

```
TICKETMASTER_API_KEY=your_consumer_key_here
```

The `.env` file is gitignored and never committed. The server will exit with a clear error message on startup if the key is missing.

### Rate limits

The free tier allows 5 requests per second and 5,000 requests per day. `fetch-and-cache.js` makes approximately 12–14 requests per run (2 venue chunks × 6 months, plus pagination if needed) and spaces them 800ms apart. Normal browsing makes 1–2 requests per month navigation. Both are well within the free-tier limits.

---

## Launch

### Standard start (recommended)

Fetches fresh event data, saves to `cache.json`, then starts the server:

```bash
npm start
```

Output:

```
VenueCal — pre-warming cache

  2026-05-01 → 2026-05-31 ... 126 events
  2026-06-01 → 2026-06-30 ... 98 events
  2026-07-01 → 2026-07-31 ... 74 events
  2026-08-01 → 2026-08-31 ... 61 events
  2026-09-01 → 2026-09-30 ... 43 events
  2026-10-01 → 2026-10-31 ... 38 events

Saved 6 cache entries → cache.json

Starting server…

VenueCal running at http://localhost:4000
Venues loaded: 8
Cache pre-loaded: 6 entries from cache.json
API key: Lh3WI9...
```

Then open **http://localhost:4000** in a browser.

### Quick start (uses existing cache)

Skips the fetch step — starts the server immediately using whatever is in `cache.json`:

```bash
npm run start:quick
```

Useful when you've already pre-warmed recently and just need to restart the server.

### Custom port

```bash
PORT=8080 npm start
```

### Running from any directory

Both scripts use `__dirname`-relative paths, so you can invoke them from anywhere:

```bash
node /full/path/to/VenueCal/scripts/fetch-and-cache.js
node /full/path/to/VenueCal/server.js
```

This makes it straightforward to point a Windows Task Scheduler entry or a shell shortcut directly at the script without setting a working directory.

---

## Scheduled nightly refresh (optional)

Running `npm start` (or `node scripts/fetch-and-cache.js`) nightly keeps event data fresh and ensures the server is always warm on first load.

### Windows Task Scheduler

- **Program:** `node`
- **Arguments:** `C:\path\to\VenueCal\scripts\fetch-and-cache.js`
- **Start in:** *(leave blank — the script is location-independent)*
- **Schedule:** Daily, e.g. 3:00 AM

### Linux / macOS cron

```cron
0 3 * * * node /path/to/VenueCal/scripts/fetch-and-cache.js
```

For this machine, a concrete example would be:

```cron
0 3 * * * /usr/bin/node /home/crog/Projects/VenueCal/scripts/fetch-and-cache.js >> /home/crog/Projects/VenueCal/fetch-and-cache.log 2>&1
```

This runs the cache refresh every day at `3:00 AM` and appends output to `fetch-and-cache.log`.

## systemd service

This repo includes a ready-to-install unit at [systemd/venuecal.service](/home/crog/Projects/VenueCal/systemd/venuecal.service:1) for this machine.

It runs VenueCal as user `crog` from:

```text
/home/crog/Projects/VenueCal
```

and starts the app using the normal production command:

```bash
/usr/bin/npm start
```

### Install as a system service

```bash
sudo cp /home/crog/Projects/VenueCal/systemd/venuecal.service /etc/systemd/system/venuecal.service
sudo systemctl daemon-reload
sudo systemctl enable --now venuecal.service
```

### Check status and logs

```bash
systemctl status venuecal.service
journalctl -u venuecal.service -f
```

If you move the repo or run it as a different user, update `User=`, `Group=`, and `WorkingDirectory=` in the unit file before installing it.

---

## API reference

The Express server exposes three endpoints, all prefixed `/api`.

### `GET /api/venues`

Returns the configured venue list.

```json
[
  { "id": "red-rocks", "name": "Red Rocks Amphitheatre", "color": "#e05c2a", "limitedCoverage": false },
  ...
]
```

### `GET /api/events`

Returns normalized events for the requested date range and venues.

**Query parameters:**

| Parameter | Format | Default |
|---|---|---|
| `start` | `YYYY-MM-DD` | Today |
| `end` | `YYYY-MM-DD` | 90 days out |
| `venues` | Comma-separated venue slugs | All venues |

**Example:**

```
GET /api/events?start=2026-06-01&end=2026-06-30&venues=red-rocks,ogden
```

**Response:**

```json
{
  "events": [
    {
      "id": "Z7r9jZ1A7...",
      "name": "Artist Name",
      "date": "2026-06-14",
      "time": "20:00:00",
      "venueId": "KovZpZAaeIvA",
      "venueName": "Red Rocks Amphitheatre",
      "url": "https://www.ticketmaster.com/event/...",
      "imageUrl": "https://s1.ticketm.net/...",
      "venueSlug": "red-rocks",
      "venueColor": "#e05c2a",
      "venueLimitedCoverage": false
    }
  ],
  "fromCache": true,
  "start": "2026-06-01",
  "end": "2026-06-30",
  "count": 14
}
```

### `POST /api/cache/bust`

Clears the in-memory cache. The browser's refresh button calls this before re-fetching events.

```json
{ "ok": true, "message": "Cache cleared" }
```

---

## Development

To auto-restart the server on file changes during development:

```bash
npm run dev
```

This uses Node's built-in `--watch` flag (Node ≥ 18). Note that it starts the server directly without pre-warming the cache — use `npm start` or `npm run start:quick` for normal use.

---

## Browser support

The frontend uses `fetch`, `async/await`, optional chaining, and CSS grid with no polyfills or transpilation. Any current version of Chrome, Firefox, Edge, or Safari works. Internet Explorer does not.

---

## Known quirks

**Duplicate event listings.** Ticketmaster sometimes creates two separate event records for the same show — for example, a general admission listing and a reserved seating listing. These have different event IDs so they appear as two rows. This is a Ticketmaster data issue, not a bug in VenueCal.

---

## Troubleshooting

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::4000
```

A previous server process is still running. Kill it and restart:

```bash
# Linux / macOS
kill $(lsof -ti:4000)

# or
fuser -k 4000/tcp
```

On Windows (PowerShell):

```powershell
$port = 4000
$pid = (netstat -ano | Select-String ":$port " | Select-Object -First 1).ToString().Trim().Split()[-1]
Stop-Process -Id $pid -Force
```

Then run `npm start` again. To avoid this, use a port that nothing else occupies — set `PORT=` in `.env` to make it permanent.

### npm install fails with EIO symlink error

```
npm error EIO: i/o error, symlink '../mime/cli.js' -> '...'
```

The project is on an NTFS-mounted drive (e.g., a Windows drive mounted in WSL or Linux). NTFS does not support the symlinks npm creates in `node_modules/.bin`. Always install with:

```bash
npm install --no-bin-links
```

This skips the symlink step. The app itself is unaffected — it doesn't use any of those CLI binaries at runtime.

### Server starts but the page is blank / shows no events

1. Check the browser console for errors — a failed `/api/venues` or `/api/events` call will show there
2. Confirm the server is running on the expected port and that you're opening the right URL
3. Check the server terminal for a startup error — a missing or invalid API key will print a clear message and exit

### Ticketmaster returns 429 (rate limited)

The browser will show a toast error. Wait 30–60 seconds and click the refresh button. This only happens if you navigate months very rapidly or run the fetch-and-cache script back-to-back multiple times.

---

## Adding or changing venues

Edit `venues.js`. Each entry requires:

```js
{
  id: 'slug-used-in-api',      // URL-safe identifier
  name: 'Display Name',
  tmId: 'KovZ...',             // Ticketmaster venue ID
  tmAliases: ['Z7r...'],       // Optional alternate IDs returned in event payloads
  color: '#rrggbb',            // Badge color
  limitedCoverage: false,      // Set true if TM data is sparse
}
```

To find the Ticketmaster ID for a new venue:

```bash
npm run lookup-venues
```

This queries the TM Venues endpoint for each name in the script and prints the matching IDs. Add the result to `venues.js` and restart.
