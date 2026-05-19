# Fix Venue Mapping for Denver Venues with Multiple Ticketmaster IDs

Some Denver music venues (such as Red Rocks, Mission Ballroom, Gothic Theatre, Ogden Theatre, and Bluebird Theater) have multiple Ticketmaster IDs (e.g., legacy query IDs vs. internal canonical IDs returned in event payloads). This causes some events to not map correctly to our venue configuration, resulting in generic grey badges and unformatted display names (e.g., showing "Red Rocks Amphitheatre" in grey instead of "Red Rocks" in orange).

To solve this, we will update our venue configuration and server-side mapping to support both query-time and payload-returned IDs for each venue.

## Proposed Changes

### [venues.js](file:///v:/Projects/VenueCal/venues.js)
- Update `tmId` for the affected venues to be an array of Ticketmaster IDs (primary/query IDs and alternative/canonical IDs).
- For unaffected venues, `tmId` can remain as a string (or array of a single string) for compatibility.

#### [MODIFY] [venues.js](file:///v:/Projects/VenueCal/venues.js)
```javascript
module.exports = [
  {
    id: 'red-rocks',
    name: 'Red Rocks Amphitheatre',
    tmId: ['KovZpZAaeIvA', 'ZFr9jZe71a'],
    color: '#e05c2a',
    limitedCoverage: false,
  },
  {
    id: 'mission-ballroom',
    name: 'Mission Ballroom',
    tmId: ['KovZ917AxRI', 'Z7r9jZadVI'],
    color: '#4a9eda',
    limitedCoverage: false,
  },
  {
    id: 'fillmore',
    name: 'Fillmore Auditorium',
    tmId: 'KovZpZAE6eJA',
    color: '#8b5cf6',
    limitedCoverage: false,
  },
  {
    id: 'ogden',
    name: 'Ogden Theatre',
    tmId: ['KovZpZAJv67A', 'ZFr9jZedde'],
    color: '#10b981',
    limitedCoverage: false,
  },
  {
    id: 'gothic',
    name: 'Gothic Theatre',
    tmId: ['KovZpZAanJEA', 'ZFr9jZdde7'],
    color: '#f59e0b',
    limitedCoverage: false,
  },
  {
    id: 'marquis',
    name: 'Marquis Theater',
    tmId: 'KovZpZAJeFkA',
    color: '#ec4899',
    limitedCoverage: false,
  },
  {
    id: 'bluebird',
    name: 'Bluebird Theater',
    tmId: ['KovZpZAkEk1A', 'Z6r9jZdvee'],
    color: '#3b82f6',
    limitedCoverage: true,
  },
  {
    id: 'summit',
    name: 'Summit Music Hall',
    tmId: 'KovZpZAFFt1A',
    color: '#14b8a6',
    limitedCoverage: true,
  },
  {
    id: 'federal',
    name: 'The Federal Theatre',
    tmId: 'KovZ917AVFY',
    color: '#ef4444',
    limitedCoverage: false,
  },
];
```

### Backend Logic

#### [MODIFY] [server.js](file:///v:/Projects/VenueCal/server.js)
- Update query-time ID extraction using `flatMap` to support venues with multiple `tmId`s.
- Update mapping builder (`tmIdToVenue`) to map every individual ID (primary or alias) to the same venue metadata object.

```javascript
    const tmIds = targetVenues.flatMap(v => Array.isArray(v.tmId) ? v.tmId : [v.tmId]);

    const { events, fromCache } = await fetchEvents(tmIds, start, end, API_KEY);

    // Attach our internal venue metadata to each event for the frontend
    const tmIdToVenue = {};
    for (const v of venues) {
      const ids = Array.isArray(v.tmId) ? v.tmId : [v.tmId];
      for (const id of ids) {
        tmIdToVenue[id] = v;
      }
    }
```

#### [MODIFY] [fetch-and-cache.js](file:///v:/Projects/VenueCal/scripts/fetch-and-cache.js)
- Update query-time ID extraction using `flatMap` to support multiple `tmId`s per venue.

```javascript
  const tmIds = venues.flatMap(v => Array.isArray(v.tmId) ? v.tmId : [v.tmId]);
```

## Verification Plan

### Automated/Local Verification
1. We will verify the configuration changes using the local node interpreter.
2. We will run the server using `npm start` or the quickstart script to verify that the cache pre-warm and server start successfully.
3. We will inspect the returned `/api/events` payload to ensure that events with both `KovZpZAaeIvA` and `ZFr9jZe71a` map properly to the `red-rocks` venue slug and its custom orange color (`#e05c2a`).
