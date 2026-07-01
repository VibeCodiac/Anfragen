const express = require('express');
const multer = require('multer');
const admin = require('firebase-admin');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'geheim123';

const rawBase64 = (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
console.log('FIREBASE_SERVICE_ACCOUNT_BASE64 Länge:', rawBase64.length);

const serviceAccountJson = Buffer.from(rawBase64, 'base64').toString('utf8');

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
  console.log('JSON geparst. Enthaltene Keys:', Object.keys(serviceAccount));
  console.log('project_id vorhanden:', !!serviceAccount.project_id);
} catch (e) {
  console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 konnte nicht als JSON gelesen werden.');
  console.error('Erste 80 Zeichen:', serviceAccountJson.slice(0, 80));
  throw e;
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const eventDoc = db.collection('app').doc('event');
const responsesCollection = db.collection('responses');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(require('path').join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  const pw = req.headers['x-admin-password'] || req.body.password || req.query.password;
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Falsches Passwort' });
  next();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ntfyRequest(body, attempt) {
  return new Promise((resolve, reject) => {
    const bodyBuffer = Buffer.from(body, 'utf8');
    const headers = {
      'Content-Type': 'text/plain',
      'Content-Length': bodyBuffer.length
    };
    if (process.env.NTFY_TOKEN) {
      headers['Authorization'] = 'Bearer ' + process.env.NTFY_TOKEN;
    }
    const options = {
      hostname: 'ntfy.sh',
      port: 443,
      path: '/' + process.env.NTFY_TOPIC,
      method: 'POST',
      headers
    };
    const req = https.request(options, (res) => {
      console.log(`ntfy Status (Versuch ${attempt}):`, res.statusCode);
      resolve(res.statusCode);
    });
    req.on('error', (e) => {
      console.error('ntfy Fehler:', e.message);
      reject(e);
    });
    req.write(bodyBuffer);
    req.end();
  });
}

async function sendNtfy(body) {
  if (!process.env.NTFY_TOPIC) {
    console.log('NTFY_TOPIC nicht gesetzt');
    return null;
  }
  const status = await ntfyRequest(body, 1);
  if (status === 429) {
    console.log('ntfy 429 – warte 15 Sekunden und versuche es erneut...');
    await sleep(15000);
    return ntfyRequest(body, 2);
  }
  return status;
}

// ---------- Öffentliche Routen ----------

app.get('/api/event', async (req, res) => {
  try {
    const snap = await eventDoc.get();
    const data = snap.exists ? snap.data() : { name: 'Du', dateISO: '', photo: null };
    const { accessCode, ...publicData } = data;
    res.json(publicData);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Fehler beim Laden' }); }
});

app.post('/api/verify-code', async (req, res) => {
  try {
    const { code } = req.body;
    const snap = await eventDoc.get();
    const data = snap.exists ? snap.data() : {};
    const correct = data.accessCode;
    if (correct === undefined || correct === null || correct === '') return res.json({ valid: true });
    res.json({ valid: String(code).trim() === String(correct).trim() });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Fehler bei der Prüfung' }); }
});

app.get('/api/admin/event', requireAdmin, async (req, res) => {
  try {
    const snap = await eventDoc.get();
    res.json(snap.exists ? snap.data() : {});
  } catch (e) { console.error(e); res.status(500).json({ error: 'Fehler beim Laden' }); }
});

app.post('/api/respond', async (req, res) => {
  try {
    const { answer, alternative, alternativeISO, message, activity } = req.body;
    if (!answer || (answer !== 'ja' && answer !== 'nein')) {
      return res.status(400).json({ error: 'Ungültige Antwort' });
    }
    const entry = {
      answer,
      alternative: answer === 'nein' ? (alternative || '').trim() : null,
      alternativeISO: answer === 'nein' ? (alternativeISO || null) : null,
      message: (message || '').trim(),
      activity: activity || null,
      createdAt: new Date().toISOString()
    };
    const ref = await responsesCollection.add(entry);

    const antwort = entry.answer === 'ja' ? 'Ja' : 'Nein';
    const lines = [`Antwort: ${antwort}`];
    if (entry.alternative) lines.push(`Alt: ${entry.alternative}`);
    if (entry.activity) lines.push(`Akt: ${entry.activity}`);
    if (entry.message) lines.push(`Gruss: ${entry.message}`);

    sendNtfy(lines.join('\n'))
      .then(s => console.log('ntfy final Status:', s))
      .catch(err => console.error('ntfy fehlgeschlagen:', err));

    res.json({ success: true, entry: { id: ref.id, ...entry } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Fehler beim Speichern' }); }
});

app.get('/api/responses', async (req, res) => {
  try {
    const snap = await responsesCollection.orderBy('createdAt', 'asc').get();
    res.json(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Fehler beim Laden' }); }
});

// ---------- Admin-Routen ----------

app.post('/api/admin/test-push', requireAdmin, async (req, res) => {
  if (!process.env.NTFY_TOPIC) {
    return res.status(400).json({ error: 'NTFY_TOPIC nicht gesetzt' });
  }
  try {
    const status = await sendNtfy('Test: Push funktioniert!');
    res.json({ success: status !== 429, ntfyStatus: status });
  } catch (e) {
    console.error('Test-Push fehlgeschlagen:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/login', requireAdmin, (req, res) => res.json({ success: true }));

app.post('/api/admin/reset', requireAdmin, async (req, res) => {
  try {
    const snap = await responsesCollection.get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Fehler beim Zurücksetzen' }); }
});

app.post('/api/admin/upload', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const snap = await eventDoc.get();
    const updated = snap.exists ? { ...snap.data() } : {};
    if (req.body.name) updated.name = req.body.name;
    if (req.body.dateISO) updated.dateISO = req.body.dateISO;
    if (req.body.accessCode !== undefined && req.body.accessCode !== '') updated.accessCode = req.body.accessCode;
    if (req.file) updated.photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await eventDoc.set(updated, { merge: true });
    res.json({ success: true, event: updated });
  } catch (e) {
    console.error('Fehler in /api/admin/upload:', e);
    res.status(500).json({ error: e.message || 'Fehler beim Speichern' });
  }
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

app.use((err, req, res, next) => {
  console.error('Unerwarteter Fehler:', err);
  res.status(500).json({ error: err.message || 'Unbekannter Serverfehler' });
});
