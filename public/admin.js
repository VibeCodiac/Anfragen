// ntfy-Einstellungen – gleiche Werte wie in script.js
const NTFY_TOPIC = 'bier_fur_vier';  // z. B. 'stephan-bier-runde-42'
const NTFY_TOKEN = 'tk_pnxmh4thdw1e9m5ui9sctxvms8lgf';           // dein Token von ntfy.sh/account

const loginCard = document.getElementById('login-card');
const adminCard = document.getElementById('admin-card');
const pwInput = document.getElementById('pw');
const loginBtn = document.getElementById('login-btn');
const loginStatus = document.getElementById('login-status');

const upName = document.getElementById('up-name');
const upDate = document.getElementById('up-date');
const upPhoto = document.getElementById('up-photo');
const upCode = document.getElementById('up-code');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');
const calBtn = document.getElementById('cal-btn');
const testPushBtn = document.getElementById('test-push-btn');
const testPushStatus = document.getElementById('test-push-status');

const adminResponses = document.getElementById('admin-responses');
const resetBtn = document.getElementById('reset-btn');
const resetStatus = document.getElementById('reset-status');

let adminPassword = '';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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

loginBtn.addEventListener('click', async () => {
  const pw = pwInput.value;
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  });
  if (res.ok) {
    adminPassword = pw;
    loginCard.classList.add('hidden');
    adminCard.classList.remove('hidden');
    loadCurrentEvent();
    loadAdminResponses();
  } else {
    loginStatus.textContent = '❌ Falsches Passwort';
    loginStatus.className = 'status show err';
  }
});

async function loadCurrentEvent() {
  const res = await fetch('/api/admin/event', {
    headers: { 'x-admin-password': adminPassword }
  });
  const ev = await res.json();
  upName.value = ev.name || '';
  upDate.value = ev.dateISO || '';
  upCode.value = ev.accessCode || '';
}

function resizeImage(file, maxWidth = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })),
        'image/jpeg', quality
      );
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

uploadBtn.addEventListener('click', async () => {
  const formData = new FormData();
  formData.append('password', adminPassword);
  if (upName.value) formData.append('name', upName.value);
  if (upDate.value) formData.append('dateISO', upDate.value);
  if (upCode.value !== '') formData.append('accessCode', upCode.value);
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Speichert…';
  try {
    if (upPhoto.files[0]) {
      const resized = await resizeImage(upPhoto.files[0]);
      formData.append('photo', resized);
    }
    const res = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: { 'x-admin-password': adminPassword },
      body: formData
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Unbekannter Fehler');
    }
    uploadStatus.textContent = '✅ Gespeichert!';
    uploadStatus.className = 'status show ok';
  } catch (err) {
    uploadStatus.textContent = `❌ Fehler beim Speichern: ${err.message}`;
    uploadStatus.className = 'status show err';
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Speichern';
  }
});

calBtn.addEventListener('click', () => {
  if (!upDate.value) return;
  downloadICS({ title: `Treffen mit ${upName.value || 'Person'}`, dateTimeLocal: upDate.value, notes: '' });
});

testPushBtn.addEventListener('click', async () => {
  testPushBtn.disabled = true;
  testPushBtn.textContent = 'Sendet…';
  try {
    const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + NTFY_TOKEN },
      body: 'Test: Push funktioniert!'
    });
    if (res.ok) {
      testPushStatus.textContent = '✅ Test-Push gesendet!';
      testPushStatus.className = 'status show ok';
    } else {
      testPushStatus.textContent = `❌ Fehler: Status ${res.status}`;
      testPushStatus.className = 'status show err';
    }
  } catch (e) {
    testPushStatus.textContent = `❌ Netzwerkfehler: ${e.message}`;
    testPushStatus.className = 'status show err';
  } finally {
    testPushBtn.disabled = false;
    testPushBtn.textContent = '📲 Test-Push senden';
  }
});

async function loadAdminResponses() {
  const res = await fetch('/api/responses');
  const list = await res.json();
  if (!list.length) {
    adminResponses.innerHTML = '<p class="sub">Noch keine Rückmeldungen.</p>';
    return;
  }
  adminResponses.innerHTML = list.slice().reverse().map(r => {
    const tag = r.answer === 'ja' ? '<span class="tag ja">Ja</span>' : '<span class="tag nein">Nein</span>';
    const alt = r.alternativeISO ? ` – Alternative: <strong>${formatDateLabel(r.alternativeISO)}</strong>` : '';
    const act = r.activity ? `<br>🎡 Aktivität: <strong>${escapeHtml(r.activity)}</strong>` : '';
    const m = r.message ? `<br>💬 ${escapeHtml(r.message)}` : '';
    const time = new Date(r.createdAt).toLocaleString('de-DE');
    const calBtnHtml = r.alternativeISO
      ? `<div><button class="cal-btn" data-iso="${r.alternativeISO}">📅 In Kalender übernehmen</button></div>`
      : '';
    return `<div class="recent-item">${tag}${alt}${act}${m}<br><small>${time}</small>${calBtnHtml}</div>`;
  }).join('');

  adminResponses.querySelectorAll('.cal-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      downloadICS({ title: `Treffen mit ${upName.value || 'Person'}`, dateTimeLocal: btn.dataset.iso, notes: '' });
    });
  });
}

resetBtn.addEventListener('click', async () => {
  if (!confirm('Wirklich alle Rückmeldungen löschen?')) return;
  const res = await fetch('/api/admin/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
    body: JSON.stringify({})
  });
  if (res.ok) {
    resetStatus.textContent = '✅ Zurückgesetzt!';
    resetStatus.className = 'status show ok';
    loadAdminResponses();
  } else {
    resetStatus.textContent = '❌ Fehler';
    resetStatus.className = 'status show err';
  }
});
