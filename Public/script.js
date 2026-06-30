const ORGANIZER_NAME = 'Stephan';

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

let answer = null;
let eventDateISO = null;
let lastSubmittedISO = null;

function formatDateLabel(dateISO) {
  if (!dateISO) return '';
  const d = new Date(dateISO + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function downloadICS({ title, dateISO, notes }) {
  if (!dateISO) return;
  const d = dateISO.replace(/-/g, '');
  const next = new Date(dateISO);
  next.setDate(next.getDate() + 1);
  const dEnd = next.toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lass-uns-was-machen//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@lass-uns-was-machen`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${dEnd}`,
    `SUMMARY:${title}`,
    notes ? `DESCRIPTION:${notes.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'termin.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function loadEvent() {
  const res = await fetch('/api/event');
  const ev = await res.json();
  nameEl.textContent = ev.name || 'Du';
  eventDateISO = ev.dateISO || null;
  dateEl.textContent = eventDateISO ? formatDateLabel(eventDateISO) : 'bald';
  if (ev.photo) {
    photoWrap.innerHTML = `<img src="${ev.photo}" alt="Foto" />`;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadResponses() {
  const res = await fetch('/api/responses');
  const list = await res.json();
  if (!list.length) {
    recentBox.style.display = 'none';
    return;
  }
  recentBox.style.display = 'block';
  responsesList.innerHTML = list.slice(-5).reverse().map(r => {
    const tag = r.answer === 'ja'
      ? '<span class="tag ja">Ja</span>'
      : '<span class="tag nein">Nein</span>';
    const alt = r.alternativeISO ? ` – Alternative: <strong>${formatDateLabel(r.alternativeISO)}</strong>` : '';
    const m = r.message ? `<br>💬 ${escapeHtml(r.message)}` : '';
    return `<div class="recent-item">${tag}${alt}${m}</div>`;
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
        message: msg.value
      })
    });

    if (!res.ok) throw new Error('Fehler beim Senden');

    statusEl.textContent = '✅ Danke für deine Antwort!';
    statusEl.className = 'status show ok';

    lastSubmittedISO = answer === 'ja' ? eventDateISO : alternativeISO;
    openCalendarPopup(lastSubmittedISO);

    msg.value = '';
    altDateInput.value = '';
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
  downloadICS({
    title: `Treffen mit ${ORGANIZER_NAME}`,
    dateISO: lastSubmittedISO,
    notes: ''
  });
  popupOverlay.classList.remove('show');
});

popupCloseBtn.addEventListener('click', () => popupOverlay.classList.remove('show'));
popupOverlay.addEventListener('click', (e) => {
  if (e.target === popupOverlay) popupOverlay.classList.remove('show');
});

loadEvent();
loadResponses();
