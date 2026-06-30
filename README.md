# Lass-uns-was-machen – Einladungsseite

Eine kleine Web-App: Foto + Text + Ja/Nein-Auswahl + Alternativ-Termin + Gruß
+ Kalendereintrag (.ics, iPhone-kompatibel), plus Admin-Bereich zum
Zurücksetzen, Foto-Upload und Termin-Pflege.

## Lokal starten

```
cd event-app
npm install
npm start
```
Im Browser öffnen: http://localhost:3000

Admin-Bereich: http://localhost:3000/admin.html
Standard-Passwort: `geheim123` (änderbar über die Umgebungsvariable `ADMIN_PASSWORD`)

---

## Kostenlos online stellen (GitHub + Render.com)

Render.com bietet ein kostenloses Node.js-Hosting mit dauerhaftem Server.
Ein direkter ZIP-Upload ist dort nicht vorgesehen — Render zieht den Code
aus einem GitHub-Repository. Das ist in 10 Minuten erledigt:

### 1. GitHub-Repository anlegen
1. Auf github.com einen kostenlosen Account erstellen (falls noch nicht vorhanden)
2. Oben rechts auf "+" → "New repository" klicken
3. Namen vergeben (z. B. `lass-uns-was-machen`), auf "Create repository" klicken

### 2. Dieses ZIP hochladen
1. Im neuen Repository auf "Add file" → "Upload files" klicken
2. Den **Inhalt** des entpackten ZIP-Ordners hineinziehen (nicht den ZIP-Ordner selbst,
   sondern die Dateien darin: `server.js`, `package.json`, `public/`, …)
3. Unten auf "Commit changes" klicken

### 3. Bei Render.com verbinden
1. Auf render.com kostenlos registrieren (Login auch direkt mit GitHub-Account möglich)
2. "New +" → "Web Service" klicken
3. Das gerade erstellte GitHub-Repository auswählen
4. Einstellungen:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Unter "Environment Variables" hinzufügen:
   - Key: `ADMIN_PASSWORD`, Value: dein eigenes Passwort
6. Auf "Create Web Service" klicken

Nach ein bis zwei Minuten ist die Seite live unter einer Adresse wie
`https://lass-uns-was-machen.onrender.com`.

**Wichtig beim kostenlosen Render-Tarif:**
- Der Server "schläft" nach 15 Minuten Inaktivität ein und braucht beim
  nächsten Aufruf ca. 30–50 Sekunden zum Aufwachen.
- Hochgeladene Fotos und Antworten werden auf der Festplatte des Servers
  gespeichert. Bei jedem neuen Deploy (z. B. nach einer Code-Änderung)
  wird diese zurückgesetzt. Für eine dauerhaftere Speicherung später
  z. B. eine kostenlose Render-"Disk" oder eine externe Datenbank ergänzen.

### Updates später hochladen
Einfach im GitHub-Repository die geänderten Dateien erneut hochladen
(„Upload files" oder Datei direkt im Editor bearbeiten) — Render deployt
automatisch neu.

---

## Projektstruktur

- Frontend: `public/index.html`, `style.css`, `script.js`
- Backend: `server.js` (Express)
- Daten: `data/event.json`, `data/responses.json` (werden automatisch angelegt)
- Fotos: `uploads/`
