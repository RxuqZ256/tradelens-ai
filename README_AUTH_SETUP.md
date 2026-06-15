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
