# TradeLens AI – Auth-Setup (Phase 1)

Diese Anleitung beschreibt, wie du die echte E-Mail/Passwort-Anmeldung über Supabase
in Betrieb nimmst und lokal testest. Phase 1 umfasst Registrierung, E-Mail-Bestätigung,
Login, Logout und Passwort-Reset sowie eine Profil-Grundtabelle mit RLS.

> Wichtig: Solange `APP_MODE` auf `"preview"` steht, sind Login und App weiterhin als
> reine **Design-Vorschau** ohne Auth-Sperre lokal öffnenbar – auch ohne Supabase-Keys.

---

## 1. Dateien

| Datei | Zweck |
|-------|-------|
| `TradeLens_AI_Login.html` | Login-/Registrierungs-/Passwort-Screens (echte Supabase-Anbindung) |
| `TradeLens_AI_App.html` | Haupt-App mit Auth-Guard + „Abmelden" im Profil |
| `tradelens-config.js` | Öffentliche Konfiguration (URL, Anon-Key, Modus, Redirect-URL) |
| `tradelens-auth.js` | Gemeinsame Auth-Schicht (`window.TLAuth`) |
| `supabase_setup.sql` | Profil-Tabelle, RLS-Policies, Auth-Trigger |

Alle Dateien müssen **im selben Ordner** liegen (relative Pfade).

---

## 2. Lokalen Webserver starten (nicht `file://`)

Echte Auth-Tests müssen über `http://localhost` laufen, da Supabase keine
`file://`-Redirects erlaubt. Im Projektordner einen der folgenden Befehle ausführen:

```bash
# Variante A (Python 3)
python3 -m http.server 5173

# Variante B (Node)
npx serve -l 5173
```

Danach im Browser öffnen:

```
http://localhost:5173/TradeLens_AI_Login.html
```

> Der Port `5173` muss zur `REDIRECT_URL` in `tradelens-config.js` passen.

---

## 3. Supabase-Projekt vorbereiten

1. Projekt unter https://supabase.com anlegen (oder vorhandenes nutzen).
2. **SQL ausführen:** Dashboard → SQL Editor → New query → Inhalt von
   `supabase_setup.sql` einfügen → **Run**.
   Damit entstehen: Tabelle `public.profiles`, RLS-Policies (eigenes Profil
   lesen/aktualisieren), `updated_at`-Trigger und der Auth-Trigger
   `handle_new_user` (legt das Profil automatisch an).
3. **Email-Provider:** Authentication → Providers → **Email** aktivieren.
   „Confirm email" nach Wunsch ein-/ausschalten (ein = Bestätigungsmail nötig).
4. **URL-Konfiguration:** Authentication → URL Configuration
   - **Site URL:** `http://localhost:5173`
   - **Redirect URLs:** `http://localhost:5173/TradeLens_AI_Login.html`
     (muss exakt der `REDIRECT_URL` aus der Config entsprechen)

---

## 4. Keys eintragen

In `tradelens-config.js` ersetzen (Dashboard → Project Settings → API):

```js
SUPABASE_URL:      "https://DEINPROJEKT.supabase.co",
SUPABASE_ANON_KEY: "DEIN_ANON_PUBLIC_KEY",
```

> Nur den **öffentlichen Anon/Public-Key** verwenden – **niemals** den
> geheimen Service-Role-Key im Frontend!

`REDIRECT_URL` bei Bedarf an deinen Host/Port anpassen (muss in Supabase als
Redirect-URL hinterlegt sein).

---

## 5. Von „preview" auf „production" umschalten

In `tradelens-config.js`:

```js
APP_MODE: "production",
```

- `"preview"`  → kein Auth-Guard, Design lokal frei ansehbar (Standard).
- `"production"` → Auth-Guard aktiv: `TradeLens_AI_App.html` verlangt eine
  gültige Session, sonst Weiterleitung zum Login.

> Ist `APP_MODE: "production"` gesetzt, aber noch keine gültige Konfiguration
> eingetragen, läuft die App sicherheitshalber weiter als Vorschau (keine
> Aussperrung). Echte Sperre greift erst mit gültigen Keys.

---

## 6. Testablauf

1. **Registrierung:** Login-Seite → „Registrieren" → Name, E-Mail, Passwort.
   - Mit aktivem „Confirm email": Wechsel zum Bestätigungs-Screen.
   - Ohne „Confirm email": direkte Weiterleitung in die App.
2. **E-Mail-Bestätigung:** Link in der Mail öffnen → zurück zur Login-Seite.
3. **Erneut senden:** Auf dem Bestätigungs-Screen „Versand simulieren" tippt jetzt
   einen echten erneuten Versand an (mit 30-Sekunden-Cooldown).
4. **Login:** E-Mail + Passwort → Weiterleitung in die App.
5. **Logout:** App → Profil → „Sicherheit & Daten" → **Abmelden** → zurück zum Login.
6. **Passwort vergessen:** „Passwort vergessen" → E-Mail → Reset-Mail anfordern.
7. **Neues Passwort:** Link aus der Reset-Mail öffnen → der Screen „Neues Passwort"
   erscheint **nur** bei gültigem Recovery-Zustand → neues Passwort setzen →
   Session wird beendet → zurück zum Login.

---

## 7. Fehlerbehandlung

Bekannte Supabase-Fehler werden auf verständliche deutsche Texte gemappt
(falsche Zugangsdaten, nicht bestätigte E-Mail, bereits registriert, Rate-Limit,
abgelaufener Link u. a.). Unbekannte Fehler erscheinen als neutraler Text;
technische Details/Tokens landen nur in der Browser-Konsole, nie in der UI.

---

## GitHub Pages

Endgültige Adressen der Veröffentlichung:

- **Repository:** https://github.com/RxuqZ256/tradelens-ai
- **App:** https://rxuqz256.github.io/tradelens-ai/
- **Login / Auth Redirect:** https://rxuqz256.github.io/tradelens-ai/index.html

Diese Login-/Redirect-Adresse muss in Supabase unter
Authentication → URL Configuration als **Redirect URL** (und als **Site URL**
`https://rxuqz256.github.io/tradelens-ai/`) hinterlegt sein. Für den produktiven
Betrieb steht `APP_MODE` in `tradelens-config.js` auf `"production"`.
Alle internen Weiterleitungen nutzen relative Pfade und bleiben damit innerhalb
des Unterordners `/tradelens-ai/`.

---

# Phase 2 – Profil & Einstellungen (Supabase-Persistenz)

Phase 2 macht das **Profil** und die **Einstellungen** echt: pro Nutzer
gespeichert in Supabase, mit Row Level Security, sowie einem
benutzergebundenen lokalen Cache als Offline-Fallback. Fake-Zustände
(„PRO ACCOUNT“, „BINANCE VERBUNDEN“, „SYNC AKTIV“, „Martin Klein“) wurden
durch ehrliche, neutrale Zustände ersetzt.

## 1. Was du in Supabase ausführen musst

1. Öffne **Supabase → SQL Editor → New query**.
2. Falls noch nicht geschehen: zuerst `supabase_setup.sql` (Phase 1).
3. Danach **`supabase_phase2_user_settings.sql`** einfügen und **Run**.

Das Skript ist **idempotent** und kann gefahrlos erneut ausgeführt werden.
Es legt die Tabelle `public.user_settings` (1:1 zu `auth.users`) mit
CHECK-Constraints, RLS und drei Policies (SELECT/INSERT/UPDATE – jeweils nur
die eigene Zeile, inkl. `with check`) an. **Keine** DELETE-Policy, **kein**
zusätzlicher Trigger auf `auth.users`, **keine** `notifications`-JSONB-Spalte.

## 2. Skript-Reihenfolge in der App

In `TradeLens_AI_App.html` werden die Skripte in dieser Reihenfolge geladen:

1. `tradelens-config.js`
2. Supabase-CDN (UMD)
3. `tradelens-auth.js`
4. `tradelens-data.js`  ← **neu**
5. App-Initialisierung über `tlBootstrap()` (erst nach gültiger Session)

## 3. Benutzertrennung

- Lokale Schlüssel sind **benutzergebunden**:
  `tradelens_store_v2:<user_id>` und `tradelens_profile_v2:<user_id>`.
- Die alten globalen `…_v1`-Schlüssel werden **nicht** mehr geladen
  (mögliche Demo-/Testdaten). Sie werden auch nicht gelöscht.
- Der Store wird **erst nach gültiger Session** und bekannter `user_id`
  geladen. Beim Start/Logout wird der In-Memory-Zustand zurückgesetzt
  (`resetInMemory`), damit nie kurz Daten eines anderen Kontos erscheinen.
- Maßgebliche Quelle ist **Supabase** (RLS stellt sicher: Nutzer A kann
  ausschließlich seine eigene Zeile lesen/ändern).

## 4. Welche Einstellungen jetzt wirklich synchronisiert werden

In `public.user_settings` gespeichert und appweit angewandt:

- Kontowährung (`account_currency`)
- Kontogröße (`account_size`)
- Risiko-Prozent (`risk_percent`)
- Automatische Lotberechnung (`auto_lot_calculation`)
- Signaltyp (`signal_type`: scalping/day/swing)
- CRV / Chance-Risiko-Verhältnis (`rr_target`: 1/2/3)
- Alle vier Benachrichtigungsschalter
  (`notify_signal_alerts`, `notify_price_alerts`,
  `notify_market_news`, `notify_weekly_report`)
- Erscheinungsbild (`appearance`)

Der **Risiko-Betrag** wird ausschließlich berechnet
(`account_size * risk_percent / 100`) und **nicht** gespeichert.

Speicherverhalten: Toggles/Segmente werden optimistisch übernommen und sofort
in den benutzergebundenen Cache geschrieben; anschließend folgt der Upsert nach
Supabase. Schlägt die Synchronisierung fehl, bleibt der lokale Stand erhalten
und es erscheint ein **ehrlicher Hinweis** („… Lokal gespeichert.“). Der
Konto-Dialog bestätigt erst **nach** erfolgreicher Supabase-Antwort. Es werden
keine technischen Details oder Tokens angezeigt.

Ungültige Werte (z. B. Risiko außerhalb 0,01–10 %, Kontogröße ≤ 0) werden
**nicht** gespeichert; es erscheint eine deutsche Meldung und der vorherige
gültige Zustand bleibt erhalten.

## 5. Erscheinungsbild – nur Präferenz

`appearance` wird gespeichert, beim Start wiederhergestellt und die aktive
Radio-Auswahl korrekt angezeigt. **`cyber_blue` und `quantum_violet` sind in
dieser Phase ausschließlich gespeicherte Präferenzen** – es existiert noch
keine vollständige Theme-Engine, die das App-Farbschema umfärbt. Aktuell
entspricht die Darstellung weiterhin dem Dark-Design.

## 6. Profildaten & neutralisierte Fake-Zustände

- Angezeigter Name = `profiles.display_name`; ist dieser leer, die
  **E-Mail aus der Session**; fehlt auch diese, „Profil vervollständigen“.
  Es wird **kein** Name erfunden.
- „Mitglied seit …“ stammt aus `profiles.created_at`; fehlt das Datum, wird
  die Zeile ausgeblendet.
- Account-Badge: „STANDARD ACCOUNT“ statt „PRO“. Es wird kein bezahlter Plan
  vorgetäuscht (kein Abomodell vorhanden).
- Watchlist: „NOCH NICHT VERBUNDEN“ statt „SYNC AKTIV“ (keine echte Sync).
- Broker: „Kein Broker verbunden“ statt „BINANCE VERBUNDEN“ (keine Integration).

## 7. Was NICHT verändert wurde

`tradelens-config.js`, `tradelens-auth.js`, `supabase_setup.sql`, `APP_MODE`
(weiterhin `production`), Supabase-URL/Publishable-Key, GitHub-Pages-Pfade,
`TradeLens_AI_Login.html` und `index.html` (der Anzeigename wird dort bereits
beim Signup als Metadatum übergeben) sowie das bestehende Design.

## Nächste Schritte (nach dem Hochladen)

**Supabase:** `supabase_phase2_user_settings.sql` ausführen. Danach ggf. unter
Table Editor prüfen, dass `user_settings` mit aktivem RLS existiert.

**GitHub Pages:** die geänderte `TradeLens_AI_App.html` sowie die neue
`tradelens-data.js` in das Repository hochladen (gleicher Ordner wie die
übrigen Dateien). `index.html`/`TradeLens_AI_Login.html` bleiben unverändert.

---

# Phase 3 – Chart-/Screenshot-Upload (Supabase Storage)

Phase 3 macht die vorhandene Upload-Seite echt: Datei aus Mediathek/Datei/Kamera
wählen, validieren, per **resumablem TUS-Upload** in einen **privaten** Bucket
laden, Metadaten in `analysis_uploads` speichern, Vorschau über kurzlebige
Signed URLs, Ersetzen/Entfernen mit Rollback, und nach Reload den letzten
offenen Upload wiederherstellen. **Keine KI-Analyse** in dieser Phase.

## 1. SQL ausführen

Supabase → SQL Editor → **`supabase_phase3_uploads.sql`** einfügen und **Run**.
Voraussetzung: Phase 1 + 2 wurden ausgeführt (Funktion `tl_set_updated_at()`).
Das Skript ist idempotent und legt an: Tabelle `public.analysis_uploads`
(+ CHECK-Constraints), Rechte (anon entzogen, authenticated nur SELECT/INSERT/
UPDATE/DELETE), `updated_at`-Trigger, RLS-Policies für die Tabelle **und** für
`storage.objects` (Bucket `chart-uploads`). Es legt **keinen** Bucket an.

## 2. Privaten Bucket im Dashboard anlegen

Supabase → **Storage** → **New bucket**:

- **Name:** `chart-uploads`
- **Public bucket:** AUS (privat)
- **File size limit:** 20 MB
- **Allowed MIME types:** `image/png`, `image/jpeg`, `image/webp`

Danach ist alles aktiv – die RLS-Policies aus dem SQL greifen auf diesem Bucket.

## 3. Erstellte Storage-Policies (storage.objects, Bucket chart-uploads)

Jeweils nur für Rolle `authenticated`, Ordnerprüfung
`(storage.foldername(name))[1] = (select auth.uid())::text`:

- `chart_uploads_select_own` (SELECT, USING)
- `chart_uploads_insert_own` (INSERT, WITH CHECK)
- `chart_uploads_delete_own` (DELETE, USING)

**Keine** UPDATE-Policy (Dateien werden nie überschrieben; „Ersetzen“ nutzt
immer einen neuen UUID-Pfad) und **keine** öffentliche SELECT-Policy.

## 4. Skript-Reihenfolge

1. `tradelens-config.js`
2. Supabase-CDN
3. `tradelens-auth.js`
4. `tradelens-data.js`
5. **TUS-Client-CDN** (`tus-js-client`, lädt `window.tus`)
6. **`tradelens-upload.js`** ← neu
7. App-Initialisierung (`tlBootstrap()`)

Lädt der TUS-Client nicht, wird kein Upload gestartet; beim Klick erscheint eine
verständliche Meldung („Upload-Komponente konnte nicht geladen werden …“).

## 5. Upload-Ablauf

- **Auswahl:** Bibliothek/Datei (`accept="image/png,image/jpeg,image/webp"`),
  Kamera (`accept="image/*"` + `capture="environment"`). Alle drei Wege nutzen
  dieselbe Validierung + Pipeline. Ein Abbruch der Auswahl ist kein Fehler.
- **Validierung (clientseitig):** Datei vorhanden, Größe > 0, ≤ 20 MB, MIME
  exakt PNG/JPEG/WebP; HEIC/HEIF werden verständlich abgelehnt. Keine
  reine Endungsprüfung. Bei ungültiger Datei kein Storage-/DB-Aufruf.
- **UUID** wird clientseitig erzeugt und sowohl als `analysis_uploads.id` als
  auch im Storage-Pfad verwendet: `<user_id>/<upload_id>.<ext>`. Die Endung
  stammt ausschließlich aus dem MIME-Type (png/jpg/webp), nie aus dem Original.
- **TUS-Upload:** echter Byte-Fortschritt über `onProgress(sent,total)`,
  Retry bei kurzen Netzunterbrechungen, `x-upsert: false`, nur der
  Access-Token als `Authorization`-Header. Chunk-Größe 6 MB (Supabase-Vorgabe).
- **Reihenfolge:** erst Storage-Upload, **dann** Metadaten-Insert. Schlägt der
  Insert fehl, wird die hochgeladene Datei per Storage-API wieder gelöscht
  (Rollback) und der Button bleibt deaktiviert.
- **Vorschau** über `createSignedUrl(path, 300)` – nie öffentliche URLs, nie in
  localStorage. Im benutzerspezifischen Store steht höchstens die Upload-ID.
- **Status-Zustände:** idle, validating, uploading, saving, success, error.
- **„Weiter zur Analyse“:** im Idle/Upload deaktiviert, erst nach erfolgreichem
  Storage-Upload **und** DB-Insert aktiv. Öffnet **keine** Fake-Analyse, sondern
  zeigt nur: „Upload gespeichert. Die KI-Analyse wird im nächsten Schritt
  verbunden.“ Die Mock-Ansicht `a-setup` bleibt im Code, ist aber vom
  Upload-Ablauf nicht mehr erreichbar.

**Ersetzen:** Zuerst wird der neue Upload vollständig (Storage + DB) erfolgreich
abgeschlossen, **erst danach** werden alte Storage-Datei und alter DB-Eintrag
entfernt. Schlägt der neue Upload fehl, bleibt der alte unverändert erhalten.

**Entfernen:** Erst Storage-Datei (per API), dann DB-Eintrag. Scheitert der
DB-Delete nach erfolgreichem Storage-Delete, wird erneut versucht; gelingt das
nicht, wird ehrlich gemeldet, dass nicht vollständig bereinigt wurde.
Storage-Dateien werden **niemals** per SQL gelöscht.

**Reload:** Nach gültiger Session wird der neueste eigene Datensatz mit
`status='uploaded'` (created_at desc, limit 1) geladen, eine neue Signed URL
erzeugt und die Vorschau hergestellt.

**Benutzertrennung:** Alle Uploads strikt nach `user_id` (RLS in Tabelle und
Storage). Nutzer A sieht nie Uploads/Vorschauen von Nutzer B. Beim Logout werden
Signed URL (Bild aus dem DOM) und der In-Memory-Upload geleert; benutzerspezifische
lokale Daten bleiben erhalten. Keine Bilddaten und keine Signed URL im
localStorage. Hinweis: Der TUS-Client kann temporär einen Resume-Fingerprint
(Upload-URL, keine Signed-Download-URL) ablegen; dieser wird bei Erfolg entfernt
(`removeFingerprintOnSuccess`).

## 6. Watchlist-Fix

Nur der sichtbare Überlauf der neutralen Watchlist-Karte wurde behoben
(`white-space:nowrap` → Zeilenumbruch erlaubt, `line-height` gesetzt). „NOCH
NICHT VERBUNDEN“ und der Untertext sind vollständig lesbar; keine Watchlist-
Funktion ergänzt.

## 7. Was du auf GitHub hochladen musst

- **Neu:** `tradelens-upload.js`
- **Ersetzen:** `TradeLens_AI_App.html`
- (Die SQL-Datei `supabase_phase3_uploads.sql` wird nur in Supabase ausgeführt,
  nicht auf GitHub Pages benötigt.)

Unverändert bleiben: `tradelens-config.js`, `tradelens-auth.js`,
`tradelens-data.js`, `index.html`, `TradeLens_AI_Login.html`, `APP_MODE`,
Supabase-Zugangsdaten und die GitHub-Pages-Pfade.

---

# Phase 4 – Adaptive Single-Chart-KI-Analyse (analyze-chart)

Phase 4 ergänzt eine echte ICT-Chartanalyse: Der Nutzer lädt einen Chart hoch
(Phase 3) und startet die Analyse. Eine **Supabase Edge Function** prüft Nutzer
und Upload, lädt das private Bild, ruft das KI-Modell mit strikt strukturierter
JSON-Ausgabe auf, validiert das Ergebnis deterministisch, berechnet Risk/RR
selbst und speichert alles in `public.ai_analyses`. Der Browser ruft **niemals**
den Modellanbieter direkt auf und sieht **keinen** API-Key.

## 1. SQL ausführen

Im Supabase SQL-Editor **einmalig** ausführen:

- `supabase_phase4_ai_analyses.sql`

Legt die Tabelle `public.ai_analyses` an (Status-CHECK, denormalisierte
Felder + `result jsonb`), einen **partiellen Unique-Index** auf
`(user_id, upload_id, prompt_version)` nur für `queued`/`processing`
(verhindert doppelte aktive Läufe, erlaubt aber `force_reanalysis`), aktiviert
**RLS** und vergibt `authenticated` **nur SELECT** auf eigene Zeilen. INSERT/
UPDATE/DELETE besitzt der Client nicht – das schreibt ausschließlich die Edge
Function über den Service-Role-Key.

## 2. Edge Function deployen

Ordner: `supabase/functions/analyze-chart/`
(`index.ts`, `schema.ts`, `prompt.ts`, `provider_openai.ts`, `validation.ts`,
`risk.ts`, `cors.ts`).

```
supabase functions deploy analyze-chart
```

## 3. Supabase Secrets setzen

```
supabase secrets set OPENAI_API_KEY=sk-...        # Pflicht
supabase secrets set OPENAI_MODEL=gpt-5.4-mini    # optional (Default: gpt-5.4-mini)
supabase secrets set AI_DAILY_LIMIT=10            # optional (Default: 10)
supabase secrets set AI_PROMPT_VERSION=ict-single-chart-v1  # optional
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` stellt
Supabase der Function automatisch bereit – **nicht** ins Repo/Frontend.

## 4. Funktionsweise (Analyse / No-Trade / Bestätigung)

- **Analyse:** Frontend (`tradelens-analysis.js`) ruft `analyze-chart` mit
  `{ upload_id, force_reanalysis }` und dem User-JWT. Die Function prüft Session
  (User-Client) und Upload-Eigentum (RLS), erzeugt eine **Signed URL (120 s,
  nur an das Modell, nie an Browser/DB/Logs)**, lädt die Settings, ruft das
  Modell (Responses API, `text.format`/JSON-Schema, Bild als `input_image`),
  **validiert** geometrisch (Long: SL<Entry<TP; Short: TP<Entry<SL; endliche
  Werte; Entry-Zone sortiert; SL außerhalb der Zone) und berechnet
  `risk_amount = account_size × risk_percent / 100` sowie
  `rr = |TP−Entry| / |Entry−SL|`. RR außerhalb `[max(1.8, rr_target), 4.0]`
  → `no_trade`. Ergebnis landet als validiertes JSON in `ai_analyses`; die App
  rendert es selbst in der bestehenden dunklen Trade-Card.
- **No-Trade:** `direction=none`, `entry_type=none`, alle Level `null`, keine
  Lotgröße, kein Trade-CTA. Angezeigt werden Ablehnungsgründe, erkannte
  Struktur/Liquidität und eine mögliche Beobachtungszone.
- **Bestätigung (needs_confirmation):** Ist Instrument/Timeframe unklar
  (fehlt oder Konfidenz < 50), liefert die KI **keinen** ausführbaren Trade.
  Die Ergebnis-Seite zeigt erkanntes Instrument/Timeframe + Konfidenz, ein
  Korrektur-Eingabefeld und „Analyse fortsetzen“. Der zweite Request sendet
  zusätzlich `confirmed_instrument` / `confirmed_timeframe` (serverseitig
  getrimmt/normalisiert/längenbegrenzt; Timeframe nur M1/M5/M15/M30/H1/H4/D1/W1)
  und `force_reanalysis:true`. Risiko, RR, Kontogröße, Stil und Uploadpfad
  kommen weiterhin ausschließlich aus Supabase.
- **Kostenschutz:** Ein aktiver Lauf pro Upload+Prompt-Version, gecachte
  Ergebnisse werden ohne neuen Modellaufruf zurückgegeben, Doppelklick löst
  keinen zweiten Provider-Call aus, max. 2 Modellaufrufe pro Analyse
  (Erstversuch + ein Reparaturversuch), Provider-Timeout ~55 s, Tageslimit
  (Default 10) zählt nur tatsächlich gestartete Provider-Aufrufe.
- **Lot:** In Phase 4 wird **keine** Lotgröße erfunden →
  `lot:null`, `lot_status:"instrument_specs_required"` (bzw. `"disabled"` wenn
  `auto_lot_calculation=false`). Instrument-Specs folgen in Phase 4B.

## 5. Was du auf GitHub hochladen musst

- **Neu:** `tradelens-analysis.js`
- **Ersetzen:** `TradeLens_AI_App.html`

Die Edge-Function-Dateien und `supabase_phase4_ai_analyses.sql` gehören **nicht**
auf GitHub Pages, sondern werden in Supabase deployt/ausgeführt.

Unverändert: `tradelens-config.js`, `tradelens-auth.js`, `tradelens-data.js`,
`tradelens-upload.js`, `index.html`, `TradeLens_AI_Login.html`, `APP_MODE`
(bleibt `production`), Supabase-Zugangsdaten und die GitHub-Pages-Pfade.
