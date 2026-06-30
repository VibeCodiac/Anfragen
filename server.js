const express = require('express');
const multer = require('multer');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'geheim123';

// --- Firebase Admin SDK initialisieren ---
// Der komplette Service-Account-Schlüssel wird Base64-codiert als eine einzige
// Umgebungsvariable übergeben - das vermeidet kaputte Zeilenumbrüche beim Kopieren.
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
  console.error('Erste 80 Zeichen des decodierten Inhalts:', serviceAccountJson.slice(0, 80));
  throw e;
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const eventDoc = db.collection('app').doc('event');
const responsesCollection = db.collection('responses');

// Foto wird im Arbeitsspeicher gehalten (nicht auf Festplatte) und als Base64 in Firestore gespeichert
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(require('path').join(__dirname, 'public')));

function requireAdmin(req, res, next) {
  const pw = req.headers['x-admin-password'] || req.body.password || req.query.password;
  if (pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }
  next();
}

// ---------- Öffentliche Routen ----------

app.get('/api/event', async (req, res) => {
  try {
    const snap = await eventDoc.get();
    const data = snap.exists ? snap.data() : { name: 'Du', dateISO: '', photo: null };
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

app.post('/api/respond', async (req, res) => {
  try {
    const { answer, alternative, alternativeISO, message } = req.body;

    if (!answer || (answer !== 'ja' && answer !== 'nein')) {
      return res.status(400).json({ error: 'Ungültige Antwort' });
    }

    const entry = {
      answer,
      alternative: answer === 'nein' ? (alternative || '').trim() : null,
      alternativeISO: answer === 'nein' ? (alternativeISO || null) : null,
      message: (message || '').trim(),
      createdAt: new Date().toISOString()
    };

    const ref = await responsesCollection.add(entry);

    // Push-Benachrichtigung an den Organisator schicken (falls eingerichtet)
    if (process.env.NTFY_TOPIC) {
      const summary = entry.answer === 'ja'
        ? 'Ja 🎉'
        : `Nein${entry.alternative ? ' – Alternative: ' + entry.alternative : ''}`;
      const body = entry.message ? `${summary}\n💬 ${entry.message}` : summary;

      fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
        method: 'POST',
        headers: { 'Title': 'Neue Antwort auf deine Einladung!' },
        body
      }).catch(err => console.error('ntfy-Benachrichtigung fehlgeschlagen:', err));
    }

    res.json({ success: true, entry: { id: ref.id, ...entry } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fehler beim Speichern' });
  }
});

app.get('/api/responses', async (req, res) => {
  try {
    const snap = await responsesCollection.orderBy('createdAt', 'asc').get();
    const responses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(responses);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fehler beim Laden' });
  }
});

// ---------- Admin-Routen (Passwort nötig) ----------

app.post('/api/admin/login', requireAdmin, (req, res) => {
  res.json({ success: true });
});

app.post('/api/admin/reset', requireAdmin, async (req, res) => {
  try {
    const snap = await responsesCollection.get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen' });
  }
});

app.post('/api/admin/upload', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const snap = await eventDoc.get();
    const current = snap.exists ? snap.data() : {};
    const updated = { ...current };

    if (req.body.name) updated.name = req.body.name;
    if (req.body.dateISO) updated.dateISO = req.body.dateISO;
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      updated.photo = `data:${req.file.mimetype};base64,${base64}`;
    }

    await eventDoc.set(updated, { merge: true });
    res.json({ success: true, event: updated });
  } catch (e) {
    console.error('Fehler in /api/admin/upload:', e);
    res.status(500).json({ error: e.message || 'Fehler beim Speichern' });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});

// Globaler Fehler-Handler (z. B. wenn eine Datei zu groß ist)
app.use((err, req, res, next) => {
  console.error('Unerwarteter Fehler:', err);
  res.status(500).json({ error: err.message || 'Unbekannter Serverfehler' });
});
