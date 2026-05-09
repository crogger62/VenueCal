# Denver Venue Calendar — Implementation Plan

## Overview

A personal music venue calendar for Denver, CO. Node.js/Express backend pulling event data from the Ticketmaster Discovery API, with a vanilla JS frontend offering both a monthly grid view and an agenda/list view.

**Venues:** Red Rocks Amphitheatre, Mission Ballroom, Fillmore Auditorium, Ogden Theatre, Gothic Theatre, Marquis Theater, Bluebird Theater, Summit Music Hall

**Stack:** Node.js, Express, vanilla JS, Ticketmaster Discovery API

---

## Phase 1 — Setup & API access (~1–2 hrs)

- Register for a Ticketmaster Developer account at `developer.ticketmaster.com` and obtain a free API key (Consumer Key)
- Confirm Node.js ≥ 18 is installed
- Create project folder, run `npm init`, add `.env` for API key storage

---

## Phase 2 — Backend: Node/Express API server (~2–3 hrs)

### Core server
- Scaffold Express app with `dotenv`, `axios`, and `cors`
- Create a venue config file — a simple array of venue names and their Ticketmaster venue IDs

### Ticketmaster integration
- Write a one-off venue ID lookup script: call the Venues endpoint once per venue name to get stable TM venue IDs; hardcode results in config
- Implement `GET /api/events` endpoint — queries the TM Discovery API Events endpoint filtered by venue ID and date range; returns normalized event objects (name, date, time, venue, url, image)
- Add simple in-memory cache (5–10 minute TTL) to avoid hammering the free API tier on every page load
- Handle pagination — TM returns up to 200 results per call; venues with many events need page iteration

### Known gap
- Marquis, Bluebird, and Summit may have incomplete TM coverage — verify during Phase 2 and flag any missing venues for future scraping work (see below)

---

## Phase 3 — Frontend: calendar UI (~3–4 hrs)

### Project structure
- Single-page app served as static files from Express — no framework needed at this scale

### Monthly grid view
- Render a standard month grid; days with events get dot indicators
- Clicking a day opens a panel listing that day's shows with venue, time, and a link to buy tickets
- Prev/next month navigation; fetches new date range from the API as needed

### Agenda/list view
- Chronological list of upcoming events grouped by date, spanning 60–90 days forward
- Each row: event name, venue badge, time, ticket link

### Toggle
- Calendar / Agenda toggle in header — switches view, shares the same underlying data

---

## Phase 4 — Polish & local deployment (~1–2 hrs)

- Color-code venue badges for at-a-glance venue identification
- Mobile-responsive layout
- Manual refresh button to bust the cache on demand
- Run locally via `npm start` — no hosting infrastructure needed for personal use
- Optional: `npm run fetch-and-cache` script schedulable via cron or Windows Task Scheduler to pre-warm the cache nightly

---

## Future work — scraping

> Marked as future work. Implement only if API coverage gaps are confirmed in Phase 2.

### Motivation
Fill coverage gaps for venues with weak or absent Ticketmaster presence (likely Marquis, Bluebird, Summit Music Hall).

### Approach
- Use `Playwright` or `Puppeteer` for JS-rendered pages; `cheerio` for static HTML pages
- One scraper module per venue; scrapers write into the same normalized event schema used by the TM API path
- Schedule scrapers nightly via cron; store results in a local SQLite file so the UI doesn't depend on scrape latency
- Treat scrapers as inherently fragile — build a simple health-check that flags a venue as "stale" if its last successful scrape was more than 48 hrs ago
```