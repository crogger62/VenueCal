// Denver venue config — TM IDs resolved via scripts/lookup-venues.js on 2026-05-08.
// tmAliases are alternate venue IDs returned inside Ticketmaster event payloads.
// limitedCoverage: true means the venue has weak/absent TM event data.
module.exports = [
  {
    id: 'red-rocks',
    name: 'Red Rocks Amphitheatre',
    tmId: 'KovZpZAaeIvA',
    tmAliases: ['ZFr9jZe71a'],
    color: '#e05c2a',
    limitedCoverage: false,
  },
  {
    id: 'mission-ballroom',
    name: 'Mission Ballroom',
    tmId: 'KovZ917AxRI',
    tmAliases: ['Z7r9jZadVI'],
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
    tmId: 'KovZpZAJv67A',
    tmAliases: ['ZFr9jZedde'],
    color: '#10b981',
    limitedCoverage: false,
  },
  {
    id: 'gothic',
    name: 'Gothic Theatre',
    tmId: 'KovZpZAanJEA',
    tmAliases: ['ZFr9jZdde7'],
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
    tmId: 'KovZpZAkEk1A',
    tmAliases: ['Z6r9jZdvee'],
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
    tmAliases: ['Z7r9jZakK6'],
    color: '#ef4444',
    limitedCoverage: false,
  },
];
