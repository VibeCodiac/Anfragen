const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'geheim123';

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const EVENT_FILE = path.join(DATA_DIR, 'event.json');
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json');

// Ordner sicherstellen
[DATA_DIR, UPLOAD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Default-Event anlegen, falls noch nicht vorhanden
if (!fs.existsSync(EVENT_FILE)) {
  fs.writeFileSync(EVENT_FILE, JSON.stringify({
    name: 'Du',
    dateISO: '',
    photo: null
  }, null, 2));
}
if (!fs.existsSync(RESPONSES_FILE)) {
  fs.writeFileSync(RESPONSES_FILE, JSON.stringify([], null, 2));
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Multer für Foto-Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'photo' + ext);
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// Kleine Middleware für Admin-Passwortschutz
function requireAdmin(req, res, next) {
  const pw = req.headers['x-admin-password'] || req.body.password || req.query.password;
  if (pw !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }
  next();
}

// ---------- Öffentliche Routen ----------

// Aktuelles Event holen (Name, Datum, Foto)
app.get('/api/event', (req, res) => {
  const event = readJSON(EVENT_FILE);
  res.json(event);
});

// Antwort abschicken (Ja/Nein, Alternative, Gruß)
app.post('/api/respond', (req, res) => {
  const { answer, alternative, alternativeISO, message } = req.body;

  if (!answer || (answer !== 'ja' && answer !== 'nein')) {
    return res.status(400).json({ error: 'Ungültige Antwort' });
  }

  const responses = readJSON(RESPONSES_FILE);
  const entry = {
    id: Date.now(),
    answer,
    alternative: answer === 'nein' ? (alternative || '').trim() : null,
    alternativeISO: answer === 'nein' ? (alternativeISO || null) : null,
    message: (message || '').trim(),
    createdAt: new Date().toISOString()
  };
  responses.push(entry);
  writeJSON(RESPONSES_FILE, responses);

  res.json({ success: true, entry });
});

// Alle Antworten öffentlich lesbar (damit Alternativen auf der Seite sichtbar sind)
app.get('/api/responses', (req, res) => {
  const responses = readJSON(RESPONSES_FILE);
  res.json(responses);
});

// ---------- Admin-Routen (Passwort nötig) ----------

// Login-Check
app.post('/api/admin/login', requireAdmin, (req, res) => {
  res.json({ success: true });
});

// Alles zurücksetzen (Antworten löschen)
app.post('/api/admin/reset', requireAdmin, (req, res) => {
  writeJSON(RESPONSES_FILE, []);
  res.json({ success: true });
});

// Foto + Name + Datum aktualisieren
app.post('/api/admin/upload', requireAdmin, upload.single('photo'), (req, res) => {
  const event = readJSON(EVENT_FILE);

  if (req.body.name) event.name = req.body.name;
  if (req.body.dateISO) event.dateISO = req.body.dateISO;
  if (req.file) event.photo = '/uploads/' + req.file.filename + '?t=' + Date.now();

  writeJSON(EVENT_FILE, event);
  res.json({ success: true, event });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
  console.log(`Admin-Passwort: ${ADMIN_PASSWORD} (per ADMIN_PASSWORD env var änderbar)`);
});
