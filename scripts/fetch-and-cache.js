#!/usr/bin/env node
// Pre-warms the event cache for the current month + next 5 months,
// saves it to cache.json, then starts the server.
//
// Usage:  node scripts/fetch-and-cache.js
//         npm start

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const { spawn } = require('child_process');
const { fetchEvents, persistCache } = require('../ticketmaster');
const venues = require('../venues');

const API_KEY = process.env.TICKETMASTER_API_KEY;
const CACHE_FILE = path.join(__dirname, '..', 'cache.json');

if (!API_KEY) {
  console.error('ERROR: TICKETMASTER_API_KEY is not set in .env');
  process.exit(1);
}

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

async function run() {
  console.log('VenueCal — pre-warming cache\n');

  const tmIds = venues.map(v => v.tmId);
  const now = new Date();
  let totalEvents = 0;

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const start = isoDate(y, m, 1);
    const end   = isoDate(y, m, new Date(y, m + 1, 0).getDate());

    process.stdout.write(`  ${start} → ${end} ... `);
    const { events } = await fetchEvents(tmIds, start, end, API_KEY);
    totalEvents += events.length;
    console.log(`${events.length} events`);

    // Pause between months to stay inside TM free-tier rate limits
    if (i < 5) await new Promise(r => setTimeout(r, 800));
  }

  const entries = persistCache(CACHE_FILE);
  console.log(`\nSaved ${entries} cache entries (${totalEvents} total events) → cache.json`);

  console.log('\nStarting server…\n');
  const server = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  server.on('exit', code => process.exit(code ?? 0));
}

run().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
