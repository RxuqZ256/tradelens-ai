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
