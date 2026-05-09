#!/usr/bin/env node
// One-off script: find Ticketmaster venue IDs for each Denver venue.
// Run: node scripts/lookup-venues.js
// Copy the printed IDs into venues.js.

require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.TICKETMASTER_API_KEY;
const BASE = 'https://app.ticketmaster.com/discovery/v2';

const VENUE_NAMES = [
  'Red Rocks Amphitheatre',
  'Mission Ballroom',
  'Fillmore Auditorium',
  'Ogden Theatre',
  'Gothic Theatre',
  'Marquis Theater',
  'Bluebird Theater',
  'Summit Music Hall',
];

async function lookup(name) {
  const { data } = await axios.get(`${BASE}/venues.json`, {
    params: { keyword: name, countryCode: 'US', stateCode: 'CO', apikey: API_KEY, size: 5 },
  });

  const venues = data?._embedded?.venues ?? [];
  if (!venues.length) return { name, results: [] };

  return {
    name,
    results: venues.map(v => ({
      id: v.id,
      tmName: v.name,
      city: v.city?.name,
      state: v.state?.stateCode,
    })),
  };
}

(async () => {
  for (const name of VENUE_NAMES) {
    const result = await lookup(name);
    console.log(`\n=== ${result.name} ===`);
    if (!result.results.length) {
      console.log('  No results found');
    } else {
      result.results.forEach(v =>
        console.log(`  id=${v.id}  name="${v.tmName}"  city=${v.city}, ${v.state}`)
      );
    }
  }
})();
