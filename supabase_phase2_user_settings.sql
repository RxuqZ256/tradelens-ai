-- =====================================================================
-- TradeLens AI – Supabase Setup (Phase 2: Benutzereinstellungen)
-- ---------------------------------------------------------------------
-- Ausführen im Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Voraussetzung: Phase 1 (supabase_setup.sql) wurde bereits ausgeführt
--   (Tabelle public.profiles + Auth-Trigger handle_new_user).
-- Diese Phase legt NUR die Einstellungstabelle an.
-- KEINE Tabellen für Trades, Analysen, Marktdaten oder Lernfortschritt.
-- Das Skript ist idempotent (mehrfach ausführbar).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabelle: user_settings  (1:1 zu auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id              uuid          primary key references auth.users (id) on delete cascade,
  account_currency     text          not null default 'EUR',
  account_size         numeric(18,2),
  risk_percent         numeric(5,2)  not null default 1.00,
  auto_lot_calculation boolean       not null default true,
  signal_type          text          not null default 'day',
  rr_target            integer       not null default 2,
  notify_signal_alerts boolean       not null default true,
  notify_price_alerts  boolean       not null default true,
  notify_market_news   boolean       not null default false,
  notify_weekly_report boolean       not null default true,
  appearance           text          not null default 'dark',
  created_at           timestamptz   not null default now(),
  updated_at           timestamptz   not null default now()
);

comment on table public.user_settings is
  'Persönliche App-Einstellungen je Auth-Nutzer. user_id entspricht auth.users.id.';

-- ---------------------------------------------------------------------
-- 2) CHECK-Constraints (idempotent: vorher droppen, dann neu anlegen)
-- ---------------------------------------------------------------------
alter table public.user_settings
  drop constraint if exists user_settings_account_currency_chk,
  drop constraint if exists user_settings_account_size_chk,
  drop constraint if exists user_settings_risk_percent_chk,
  drop constraint if exists user_settings_signal_type_chk,
  drop constraint if exists user_settings_rr_target_chk,
  drop constraint if exists user_settings_appearance_chk;

alter table public.user_settings
  add constraint user_settings_account_currency_chk
    check (account_currency in ('EUR','USD','GBP','CHF')),
  add constraint user_settings_account_size_chk
    check (account_size is null or account_size > 0),
  add constraint user_settings_risk_percent_chk
    check (risk_percent between 0.01 and 10),
  add constraint user_settings_signal_type_chk
    check (signal_type in ('scalping','day','swing')),
  add constraint user_settings_rr_target_chk
    check (rr_target in (1,2,3)),
  add constraint user_settings_appearance_chk
    check (appearance in ('dark','cyber_blue','quantum_violet'));

-- ---------------------------------------------------------------------
-- 3) Row Level Security aktivieren
-- ---------------------------------------------------------------------
alter table public.user_settings enable row level security;

-- Idempotent: vorhandene Policies gleichen Namens entfernen
drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;

-- Nutzer darf NUR die eigene Zeile lesen
create policy "user_settings_select_own"
  on public.user_settings
  for select
  using ( (select auth.uid()) = user_id );

-- Nutzer darf NUR die eigene Zeile anlegen
create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  with check ( (select auth.uid()) = user_id );

-- Nutzer darf NUR die eigene Zeile aktualisieren
create policy "user_settings_update_own"
  on public.user_settings
  for update
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- Bewusst KEINE DELETE-Policy und KEINE Policy für fremde Zeilen.

-- ---------------------------------------------------------------------
-- 4) updated_at automatisch pflegen
--    Nutzt die in Phase 1 angelegte Funktion public.tl_set_updated_at().
--    Fallback: Funktion bei Bedarf erneut anlegen (security definer,
--    fester search_path verhindert Hijacking).
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

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row
  execute function public.tl_set_updated_at();

-- =====================================================================
-- Fertig.
-- Hinweis: Es wird KEIN zusätzlicher Trigger auf auth.users angelegt.
-- Die Standardzeile legt der Client (UserSettingsRepository) einmalig
-- nach der ersten Anmeldung an, falls noch keine Zeile existiert.
-- =====================================================================
