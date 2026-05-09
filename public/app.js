// VenueCal — vanilla JS frontend

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const today = new Date();
today.setHours(0, 0, 0, 0);

const state = {
  view: 'calendar',
  year: today.getFullYear(),
  month: today.getMonth(),   // 0-indexed
  selectedDate: null,
  events: [],
  venues: {},                // slug → { id, name, color, limitedCoverage }
  loadedRange: null,         // "start|end" of currently cached events
};

// ── API ──────────────────────────────────────────────────────────────────────

async function apiFetch(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function loadVenues() {
  const list = await apiFetch('/api/venues');
  state.venues = Object.fromEntries(list.map(v => [v.id, v]));
}

async function loadEvents(start, end) {
  const key = `${start}|${end}`;
  if (state.loadedRange === key) return;
  setLoading(true);
  try {
    const data = await apiFetch(`/api/events?start=${start}&end=${end}`);
    state.events = data.events;
    state.loadedRange = key;
  } finally {
    setLoading(false);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function isoDate(y, m, d) {
  // m is 0-indexed
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDateLong(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function formatDateShort(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function shortVenueName(name) {
  return name
    .replace(' Amphitheatre', '')
    .replace(' Auditorium', '')
    .replace(' Music Hall', '')
    .replace(' Theatre', '')
    .replace(' Theater', '')
    .replace(' Ballroom', '')
    .trim();
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function setLoading(on) {
  document.getElementById('loading').hidden = !on;
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.hidden = !msg;
  el.textContent = msg || '';
}

// ── Event row HTML (shared by day panel + agenda) ─────────────────────────────

function eventRowHTML(e) {
  const venue = state.venues[e.venueSlug];
  const color = venue?.color ?? '#888';
  const bg = color + '22';
  const label = venue ? shortVenueName(venue.name) : (e.venueName ?? '');
  const limitedNote = venue?.limitedCoverage ? ' title="Limited Ticketmaster coverage"' : '';

  const badge = `<span class="venue-badge" style="background:${bg};color:${color}"${limitedNote}>${label}</span>`;
  const time = e.time ? `<span class="event-time">${formatTime(e.time)}</span>` : '';
  const link = e.url
    ? `<a class="ticket-link" href="${e.url}" target="_blank" rel="noopener noreferrer">Tickets</a>`
    : '';

  return `<div class="event-row">${badge}<span class="event-name">${e.name}</span>${time}${link}</div>`;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function buildEventsByDate() {
  const map = {};
  for (const e of state.events) {
    if (!e.date) continue;
    (map[e.date] = map[e.date] || []).push(e);
  }
  return map;
}

function renderCalendar() {
  document.getElementById('month-label').textContent =
    `${MONTHS[state.month]} ${state.year}`;

  const firstDayOfWeek = new Date(state.year, state.month, 1).getDay();
  const daysInMonth    = new Date(state.year, state.month + 1, 0).getDate();
  const daysInPrevMo   = new Date(state.year, state.month, 0).getDate();
  const totalCells     = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;

  const byDate = buildEventsByDate();
  const cells = [];

  for (let i = 0; i < totalCells; i++) {
    let d, m, y, otherMonth;

    if (i < firstDayOfWeek) {
      d = daysInPrevMo - firstDayOfWeek + i + 1;
      m = state.month - 1; y = state.year;
      if (m < 0) { m = 11; y--; }
      otherMonth = true;
    } else if (i >= firstDayOfWeek + daysInMonth) {
      d = i - firstDayOfWeek - daysInMonth + 1;
      m = state.month + 1; y = state.year;
      if (m > 11) { m = 0; y++; }
      otherMonth = true;
    } else {
      d = i - firstDayOfWeek + 1;
      m = state.month; y = state.year;
      otherMonth = false;
    }

    const dateStr  = isoDate(y, m, d);
    const isToday  = new Date(y, m, d).getTime() === today.getTime();
    const events   = byDate[dateStr] || [];
    const isSelect = state.selectedDate === dateStr;

    // One dot per unique venue color
    const dotColors = [...new Set(events.map(e => e.venueColor).filter(Boolean))];

    const cls = [
      'day-cell',
      otherMonth    ? 'other-month' : '',
      isToday       ? 'today'       : '',
      events.length ? 'has-events'  : '',
      isSelect      ? 'selected'    : '',
    ].filter(Boolean).join(' ');

    const dots = dotColors.length
      ? `<div class="day-dots">${dotColors.map(c => `<span class="dot" style="background:${c}"></span>`).join('')}</div>`
      : '';

    cells.push(
      `<div class="${cls}" data-date="${dateStr}"><div class="day-number">${d}</div>${dots}</div>`
    );
  }

  document.getElementById('calendar-grid').innerHTML = cells.join('');

  // Click handlers on cells with events
  document.querySelectorAll('.day-cell.has-events').forEach(cell => {
    cell.addEventListener('click', () => onDayClick(cell.dataset.date));
  });

  // Restore day panel if selected date is still visible
  const panel = document.getElementById('day-panel');
  if (state.selectedDate && byDate[state.selectedDate]) {
    renderDayPanel(state.selectedDate, byDate[state.selectedDate]);
  } else {
    state.selectedDate = null;
    panel.hidden = true;
  }
}

function onDayClick(dateStr) {
  // Toggle selection
  if (state.selectedDate === dateStr) {
    state.selectedDate = null;
    document.getElementById('day-panel').hidden = true;
    document.querySelectorAll('.day-cell.selected').forEach(el => el.classList.remove('selected'));
    return;
  }
  state.selectedDate = dateStr;
  renderCalendar(); // re-render to update selected styling
  const byDate = buildEventsByDate();
  renderDayPanel(dateStr, byDate[dateStr] || []);
}

function renderDayPanel(dateStr, events) {
  const panel = document.getElementById('day-panel');
  panel.hidden = false;
  panel.innerHTML =
    `<div class="panel-date">${formatDateLong(dateStr)}</div>` +
    events.map(eventRowHTML).join('');
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Agenda ────────────────────────────────────────────────────────────────────

function renderAgenda() {
  const byDate = buildEventsByDate();
  const dates  = Object.keys(byDate).sort();

  if (!dates.length) {
    document.getElementById('agenda-list').innerHTML =
      '<p style="color:var(--text-dim);text-align:center;padding:48px">No upcoming events found.</p>';
    return;
  }

  document.getElementById('agenda-list').innerHTML = dates.map(dateStr =>
    `<div class="agenda-date-group">
      <div class="agenda-date-header">${formatDateShort(dateStr)}</div>
      ${byDate[dateStr].map(eventRowHTML).join('')}
    </div>`
  ).join('');
}

// ── View switching ────────────────────────────────────────────────────────────

async function showCalendar() {
  state.view = 'calendar';
  document.getElementById('view-calendar').hidden = false;
  document.getElementById('view-agenda').hidden   = true;
  document.getElementById('btn-calendar').classList.add('active');
  document.getElementById('btn-agenda').classList.remove('active');

  const firstOfMonth = isoDate(state.year, state.month, 1);
  const lastOfMonth  = isoDate(state.year, state.month,
    new Date(state.year, state.month + 1, 0).getDate());

  await loadEvents(firstOfMonth, lastOfMonth);
  renderCalendar();
}

async function showAgenda() {
  state.view = 'agenda';
  document.getElementById('view-calendar').hidden = true;
  document.getElementById('view-agenda').hidden   = false;
  document.getElementById('btn-agenda').classList.add('active');
  document.getElementById('btn-calendar').classList.remove('active');

  const start = today.toISOString().slice(0, 10);
  const end   = new Date(today.getTime() + 90 * 86400_000).toISOString().slice(0, 10);

  await loadEvents(start, end);
  renderAgenda();
}

// ── Month nav ─────────────────────────────────────────────────────────────────

async function prevMonth() {
  state.month--;
  if (state.month < 0) { state.month = 11; state.year--; }
  state.selectedDate = null;
  await showCalendar();
}

async function nextMonth() {
  state.month++;
  if (state.month > 11) { state.month = 0; state.year++; }
  state.selectedDate = null;
  await showCalendar();
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function refresh() {
  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning');
  try {
    await fetch('/api/cache/bust', { method: 'POST' });
    state.loadedRange = null; // force re-fetch
    if (state.view === 'calendar') await showCalendar();
    else await showAgenda();
  } catch (err) {
    showError('Refresh failed: ' + err.message);
  } finally {
    btn.classList.remove('spinning');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  document.getElementById('btn-calendar').addEventListener('click', showCalendar);
  document.getElementById('btn-agenda').addEventListener('click', showAgenda);
  document.getElementById('btn-refresh').addEventListener('click', refresh);
  document.getElementById('prev-month').addEventListener('click', prevMonth);
  document.getElementById('next-month').addEventListener('click', nextMonth);

  try {
    await loadVenues();
    await showCalendar();
  } catch (err) {
    setLoading(false);
    showError('Failed to load: ' + err.message);
  }
}

init();
