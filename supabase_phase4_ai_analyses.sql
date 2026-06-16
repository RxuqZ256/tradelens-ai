-- =====================================================================
-- TradeLens AI – Supabase Setup (Phase 4: KI-Analysen)
-- ---------------------------------------------------------------------
-- Ausfuehren im Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Voraussetzung: Phase 1-3 wurden ausgefuehrt (profiles, user_settings,
-- analysis_uploads, Funktion public.tl_set_updated_at()).
--
-- Diese Datei legt NUR die Tabelle public.ai_analyses an (+ Grants, RLS,
-- Trigger, Idempotenz-Index). KEINE Modellschluessel, KEINE Storage-Aenderung.
-- Schreibzugriff (INSERT/UPDATE/DELETE) erfolgt ausschliesslich serverseitig
-- ueber die Edge Function (Service-Role, umgeht RLS). Der Client darf nur
-- die EIGENEN Analysen LESEN.
-- Das Skript ist idempotent (mehrfach ausfuehrbar).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabelle
-- ---------------------------------------------------------------------
create table if not exists public.ai_analyses (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  upload_id      uuid        not null references public.analysis_uploads (id) on delete cascade,
  status         text        not null default 'queued',
  provider       text,
  model          text,
  prompt_version text,
  schema_version text,
  instrument     text,
  timeframe      text,
  setup_status   text,
  direction      text,
  confidence     integer,
  result         jsonb,
  error_code     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.ai_analyses is
  'Validierte KI-Analysen je Upload/Nutzer. Schreibzugriff nur serverseitig (Edge Function, Service-Role). Clients lesen nur eigene Zeilen.';

-- ---------------------------------------------------------------------
-- 2) CHECK-Constraints (idempotent)
-- ---------------------------------------------------------------------
alter table public.ai_analyses
  drop constraint if exists ai_analyses_status_chk,
  drop constraint if exists ai_analyses_direction_chk,
  drop constraint if exists ai_analyses_confidence_chk;

alter table public.ai_analyses
  add constraint ai_analyses_status_chk
    check (status in ('queued','processing','completed','no_trade','failed','needs_confirmation')),
  add constraint ai_analyses_direction_chk
    check (direction is null or direction in ('long','short','none')),
  add constraint ai_analyses_confidence_chk
    check (confidence is null or (confidence >= 0 and confidence <= 100));

-- ---------------------------------------------------------------------
-- 3) Indizes
--    a) Listing/Reload: neueste Analyse je Upload
--    b) Idempotenz: pro (user_id, upload_id, prompt_version) hoechstens EIN
--       aktiver Lauf (queued/processing). Fertige Laeufe und force_reanalysis
--       werden dadurch NICHT blockiert.
-- ---------------------------------------------------------------------
create index if not exists ai_analyses_user_upload_created_idx
  on public.ai_analyses (user_id, upload_id, created_at desc);

create unique index if not exists ai_analyses_active_run_uidx
  on public.ai_analyses (user_id, upload_id, prompt_version)
  where status in ('queued','processing');

-- ---------------------------------------------------------------------
-- 4) Rechte: anon entziehen, authenticated NUR SELECT (kein Schreibrecht)
-- ---------------------------------------------------------------------
revoke all on table public.ai_analyses from anon;
revoke all on table public.ai_analyses from public;
grant select on table public.ai_analyses to authenticated;
-- Bewusst KEIN grant insert/update/delete an authenticated.
-- Die Edge Function nutzt den Service-Role-Key (umgeht RLS) zum Schreiben.

-- ---------------------------------------------------------------------
-- 5) updated_at-Trigger (Funktion aus Phase 1/2 wiederverwenden)
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

drop trigger if exists trg_ai_analyses_updated_at on public.ai_analyses;
create trigger trg_ai_analyses_updated_at
  before update on public.ai_analyses
  for each row
  execute function public.tl_set_updated_at();

-- ---------------------------------------------------------------------
-- 6) RLS aktivieren + NUR SELECT-Policy auf eigene Zeilen
-- ---------------------------------------------------------------------
alter table public.ai_analyses enable row level security;

drop policy if exists "ai_analyses_select_own" on public.ai_analyses;

create policy "ai_analyses_select_own"
  on public.ai_analyses
  for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Bewusst KEINE INSERT/UPDATE/DELETE-Policy fuer Clients und KEINE
-- oeffentliche/anonyme Policy. Schreiben nur serverseitig (Service-Role).

-- =====================================================================
-- Fertig.
-- =====================================================================
