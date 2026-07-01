const ORGANIZER_NAME = 'Stephan';

// ntfy-Einstellungen – hier deine echten Werte eintragen
const NTFY_TOPIC = 'was_machen1';  // z. B. 'stephan-einladung-7f3k29x'
const NTFY_TOKEN = 'tk_pnxmh4thdw1e9m5ui9sctxvms8lgf';  // z. B. 'tk_abc123...'

const gateCard = document.getElementById('gate-card');
const gateInput = document.getElementById('gate-input');
const gateBtn = document.getElementById('gate-btn');
const gateStatus = document.getElementById('gate-status');
const mainContent = document.getElementById('main-content');
const footerSignature = document.getElementById('footer-signature');

const photoWrap = document.getElementById('photo-wrap');
const nameEl = document.getElementById('name');
const dateEl = document.getElementById('date');
const btnJa = document.getElementById('btn-ja');
const btnNein = document.getElementById('btn-nein');
const altBox = document.getElementById('alt-box');
const altDateInput = document.getElementById('alt-date');
const msg = document.getElementById('msg');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');
const recentBox = document.getElementById('recent-box');
const responsesList = document.getElementById('responses-list');

const popupOverlay = document.getElementById('popup-overlay');
const popupText = document.getElementById('popup-text');
const popupAddBtn = document.getElementById('popup-add-btn');
const popupCloseBtn = document.getElementById('popup-close-btn');

const wheelBtn = document.getElementById('wheel-btn');
const wheelOverlay = document.getElementById('wheel-overlay');
const wheelResult = document.getElementById('wheel-result');
const wheelLabel = document.getElementById('wheel-label');
const wheelSpinBtn = document.getElementById('wheel-spin-btn');
const wheelCloseBtn = document.getElementById('wheel-close-btn');

let answer = null;
let eventDateISO = null;
let lastSubmittedISO = null;
let selectedActivity = null;

const ACTIVITIES = [
  { emoji: '🚲', label: 'Fahrrad fahren' },
  { emoji: '🍺', label: 'Ein Bier trinken' },
  { emoji: '🎬', label: 'Kino' },
  { emoji: '🍕', label: 'Pizza essen' },
  { emoji: '⚽', label: 'Fußball spielen' },
  { emoji: '🏊', label: 'Schwimmen' },
  { emoji: '🎳', label: 'Bowling' },
  { emoji: '🎮', label: 'Zocken' },
  { emoji: '🚶', label: 'Spazieren gehen' },
  { emoji: '☕', label: 'Café-Besuch' },
  { emoji: '🍽️', label: 'Essen gehen' },
  { emoji: '🎤', label: 'Karaoke' },
  { emoji: '🏖️', label: 'An den Strand' },
  { emoji: '🌳', label: 'Picknick' },
  { emoji: '🧗', label: 'Klettern' },
  { emoji: '🎨', label: 'Kreativ werden' },
  { emoji: '🍳', label: 'Zusammen kochen' },
  { emoji: '🛍️', label: 'Shoppen' },
  { emoji: '🎲', label: 'Spieleabend' },
  { emoji: '☀️', label: 'Sonnen' }
];

// ---------- Zugangscode ----------

async function checkAccess() {
  const code = sessionStorage.getItem('accessCode');
  if (code) {
    const ok = await verifyCode(code);
    if (ok) { showMainContent(); return; }
  }
}

async function verifyCode(code) {
  try {
    const res = await fetch('/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    return !!data.valid;
  } catch { return false; }
}

function showMainContent() {
  gateCard.style.display = 'none';
  mainContent.style.display = 'block';
  footerSignature.style.display = 'block';
  loadEvent();
  loadResponses();
}

gateBtn.addEventListener('click', async () => {
  const code = gateInput.value.trim();
  if (!code) return;
  gateBtn.disabled = true;
  gateBtn.textContent = 'Prüfe…';
  const ok = await verifyCode(code);
  gateBtn.disabled = false;
  gateBtn.textContent = 'Bestätigen';
  if (ok) {
    sessionStorage.setItem('accessCode', code);
    showMainContent();
  } else {
    gateStatus.textContent = '❌ Leider falsch, versuch es nochmal.';
    gateStatus.className = 'status show err';
  }
});

// ---------- Datum/Kalender ----------

function formatDateLabel(dateTimeLocal) {
  if (!dateTimeLocal) return '';
  const d = new Date(dateTimeLocal);
  const datePart = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const timePart = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} um ${timePart} Uhr`;
}

function pad(n) { return String(n).padStart(2, '0'); }

function downloadICS({ title, dateTimeLocal, notes }) {
  if (!dateTimeLocal) return;
  const start = new Date(dateTimeLocal);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  function fmt(d) {
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z';
  const ics = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lass-uns-was-machen//DE','CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@lass-uns-was-machen`,`DTSTAMP:${stamp}`,
    `DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,`SUMMARY:${title}`,
    notes ? `DESCRIPTION:${notes.replace(/\n/g,'\\n')}` : '',
    'END:VEVENT','END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'termin.ics';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

async function loadEvent() {
  const res = await fetch('/api/event');
  const ev = await res.json();
  nameEl.textContent = ev.name || 'Du';
  eventDateISO = ev.dateISO || null;
  dateEl.textContent = eventDateISO ? formatDateLabel(eventDateISO) : 'bald';
  if (ev.photo) photoWrap.innerHTML = `<img src="${ev.photo}" alt="Foto" />`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadResponses() {
  const res = await fetch('/api/responses');
  const list = await res.json();
  if (!list.length) { recentBox.style.display = 'none'; return; }
  recentBox.style.display = 'block';
  responsesList.innerHTML = list.slice(-5).reverse().map(r => {
    const tag = r.answer === 'ja' ? '<span class="tag ja">Ja</span>' : '<span class="tag nein">Nein</span>';
    const alt = r.alternativeISO ? ` – Alternative: <strong>${formatDateLabel(r.alternativeISO)}</strong>` : '';
    const act = r.activity ? `<br>🎡 ${escapeHtml(r.activity)}` : '';
    const m = r.message ? `<br>💬 ${escapeHtml(r.message)}` : '';
    return `<div class="recent-item">${tag}${alt}${act}${m}</div>`;
  }).join('');
}

btnJa.addEventListener('click', () => {
  answer = 'ja';
  btnJa.classList.add('active'); btnJa.classList.remove('inactive');
  btnNein.classList.remove('active'); btnNein.classList.add('inactive');
  altBox.classList.remove('show');
  submitBtn.disabled = false;
});

btnNein.addEventListener('click', () => {
  answer = 'nein';
  btnNein.classList.add('active'); btnNein.classList.remove('inactive');
  btnJa.classList.remove('active'); btnJa.classList.add('inactive');
  altBox.classList.add('show');
  submitBtn.disabled = false;
});

submitBtn.addEventListener('click', async () => {
  if (!answer) return;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Wird gesendet…';
  const alternativeISO = answer === 'nein' ? altDateInput.value : null;
  try {
    const res = await fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer,
        alternative: alternativeISO ? formatDateLabel(alternativeISO) : null,
        alternativeISO,
        message: msg.value,
        activity: selectedActivity ? `${selectedActivity.emoji} ${selectedActivity.label}` : null
      })
    });
    if (!res.ok) throw new Error('Fehler beim Senden');

    // Push direkt vom Browser – umgeht das Render-IP-Limit
    const antwort = answer === 'ja' ? 'Ja' : 'Nein';
    const lines = [`Antwort: ${antwort}`];
    if (alternativeISO) lines.push(`Alt: ${formatDateLabel(alternativeISO)}`);
    if (selectedActivity) lines.push(`Akt: ${selectedActivity.emoji} ${selectedActivity.label}`);
    if (msg.value.trim()) lines.push(`Gruss: ${msg.value.trim()}`);
    fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + NTFY_TOKEN },
      body: lines.join('\n')
    }).catch(() => {});

    statusEl.textContent = '✅ Danke für deine Antwort!';
    statusEl.className = 'status show ok';
    lastSubmittedISO = answer === 'ja' ? eventDateISO : alternativeISO;
    openCalendarPopup(lastSubmittedISO);
    msg.value = ''; altDateInput.value = '';
    loadResponses();
  } catch (e) {
    statusEl.textContent = '❌ Da ist etwas schiefgelaufen. Bitte erneut versuchen.';
    statusEl.className = 'status show err';
  } finally {
    submitBtn.textContent = 'Antwort senden';
    submitBtn.disabled = false;
  }
});

function openCalendarPopup(dateISO) {
  if (dateISO) {
    popupText.textContent = `Treffen mit ${ORGANIZER_NAME} – ${formatDateLabel(dateISO)}`;
    popupAddBtn.style.display = 'block';
  } else {
    popupText.textContent = 'Für diesen Termin wurde kein Datum hinterlegt.';
    popupAddBtn.style.display = 'none';
  }
  popupOverlay.classList.add('show');
}

popupAddBtn.addEventListener('click', () => {
  downloadICS({ title: `Treffen mit ${ORGANIZER_NAME}`, dateTimeLocal: lastSubmittedISO, notes: '' });
  popupOverlay.classList.remove('show');
});
popupCloseBtn.addEventListener('click', () => popupOverlay.classList.remove('show'));
popupOverlay.addEventListener('click', (e) => { if (e.target === popupOverlay) popupOverlay.classList.remove('show'); });

// ---------- Glücksrad ----------

function spinWheel() {
  wheelResult.classList.add('spinning');
  wheelLabel.textContent = '';
  wheelSpinBtn.disabled = true;
  let ticks = 0;
  const totalTicks = 18;
  const interval = setInterval(() => {
    const random = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
    wheelResult.textContent = random.emoji;
    ticks++;
    if (ticks >= totalTicks) {
      clearInterval(interval);
      const final = ACTIVITIES[Math.floor(Math.random() * ACTIVITIES.length)];
      wheelResult.textContent = final.emoji;
      wheelLabel.textContent = final.label;
      wheelResult.classList.remove('spinning');
      wheelSpinBtn.disabled = false;
      selectedActivity = final;
    }
  }, 90);
}

wheelBtn.addEventListener('click', () => { wheelOverlay.classList.add('show'); spinWheel(); });
wheelSpinBtn.addEventListener('click', spinWheel);
wheelCloseBtn.addEventListener('click', () => wheelOverlay.classList.remove('show'));
wheelOverlay.addEventListener('click', (e) => { if (e.target === wheelOverlay) wheelOverlay.classList.remove('show'); });

checkAccess();
