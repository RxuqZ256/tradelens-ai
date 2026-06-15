-- =====================================================================
-- TradeLens AI – Supabase Setup (Phase 1: Auth + Profil-Grundlage)
-- ---------------------------------------------------------------------
-- Ausführen im Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Diese Phase legt NUR die Profil-Grundlage an.
-- KEINE Tabellen für Trades, Analysen oder Lernfortschritt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabelle: profiles  (1:1 zu auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid        primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Öffentliches Profil je Auth-Nutzer. id entspricht auth.users.id.';

-- ---------------------------------------------------------------------
-- 2) Row Level Security aktivieren
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Idempotent: vorhandene Policies gleichen Namens entfernen
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- Nutzer darf NUR sein eigenes Profil lesen
create policy "profiles_select_own"
  on public.profiles
  for select
  using ( auth.uid() = id );

-- Nutzer darf NUR sein eigenes Profil aktualisieren
create policy "profiles_update_own"
  on public.profiles
  for update
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

-- Hinweis: KEINE INSERT-Policy für Clients.
-- Die Profilanlage erfolgt ausschließlich über den Auth-Trigger unten
-- (security definer), nicht durch das Frontend.

-- ---------------------------------------------------------------------
-- 3) updated_at automatisch pflegen
-- ---------------------------------------------------------------------
create or replace function public.tl_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.tl_set_updated_at();

-- ---------------------------------------------------------------------
-- 4) Automatische Profilanlage bei neuem Auth-Nutzer
--    - security definer  (läuft mit erhöhten Rechten, umgeht RLS sauber)
--    - fest gesetzter search_path (verhindert Hijacking)
--    - übernimmt nur benötigte Felder
--    - schreibt nichts Sensibles
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;   -- doppelte Auslösung führt zu keinem Fehler
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =====================================================================
-- Fertig. Danach in Supabase noch manuell prüfen/setzen:
--   Authentication -> Providers -> Email: aktiv, "Confirm email" nach Wunsch
--   Authentication -> URL Configuration -> Site URL + Redirect URLs
--     (muss REDIRECT_URL aus tradelens-config.js enthalten)
-- =====================================================================
