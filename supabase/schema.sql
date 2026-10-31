-- =====================================================================================
-- Preuet · base de dades a Supabase (versió web a GitHub Pages)
--
-- Com s'aplica (un sol cop):
--   1. Supabase → SQL Editor → New query → enganxa tot aquest fitxer → Run.
--   2. Authentication → Sign In / Providers → activa «Allow anonymous sign-ins».
--   3. Tria un codi d'equip per a les fitxes S01–S10 (mínim 8 caràcters) i executa:
--        select public.set_team_key('el-vostre-codi-d-equip');
--   4. (Opcional) Per moderar, copia el teu id d'Authentication → Users i executa:
--        insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000000');
--
--   5. (Opcional) Neteja automàtica: Database → Extensions → activa «pg_cron» i torna a executar aquest fitxer.
--      Cada nit esborra les aportacions de més de 120 dies i els usuaris anònims sense activitat en 180 dies.
--
-- Versió 2 (novembre de 2026): ningú no pot llegir directament la taula d'aportacions. L'app les llegeix, n'afegeix
-- i n'esborra amb funcions que no revelen qui ha escrit cada cosa; les novetats arriben per Realtime (broadcast).
-- Una persona només té una valoració per cosa valorada: la nova substitueix l'anterior.
--
-- Què guarda:
--   contributions    avisos d'estoc, preus, comentaris, valoracions i orígens (públics, sense l'autor)
--   user_state       cistella, preferències i compres periòdiques de cada usuari anònim (privat)
--   solution_tests   fitxes de les proves S01–S10 (només amb el codi d'equip)
-- Els preus i les ofertes NO són aquí: viuen a data/preuet-data.json, que s'actualitza cada setmana.
-- El fitxer es pot tornar a executar: no esborra dades.
-- =====================================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- administradors (moderació) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- aportacions de la comunitat ----------
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('stock', 'price', 'comment', 'rating', 'origin', 'suggest')),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 2048),
  created_at timestamptz not null default now()
);
create index if not exists contributions_created_at_idx on public.contributions (created_at desc);
create index if not exists contributions_user_type_idx on public.contributions (user_id, type);
alter table public.contributions enable row level security;

-- The author and the time always come from the server, and one person can add at most 40 items per 10 minutes.
-- A new rating replaces that person's earlier rating of the same thing.
create or replace function public.contributions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  if new.user_id is null then
    raise exception 'Cal una sessió per fer aportacions' using errcode = '42501';
  end if;
  if (select count(*) from public.contributions c
        where c.user_id = new.user_id and c.created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Massa aportacions seguides: torna-ho a provar d''aquí a uns minuts' using errcode = 'P0001';
  end if;
  if new.type = 'rating' then
    delete from public.contributions c
      where c.user_id = new.user_id and c.type = 'rating' and c.payload ->> 'target' = new.payload ->> 'target';
  end if;
  return new;
end;
$$;
drop trigger if exists contributions_guard on public.contributions;
create trigger contributions_guard
  before insert on public.contributions
  for each row execute function public.contributions_guard();

-- one rating per person and target (older duplicates are removed first, keeping the newest)
delete from public.contributions a
  using public.contributions b
  where a.type = 'rating' and b.type = 'rating' and a.user_id = b.user_id
    and a.payload ->> 'target' = b.payload ->> 'target'
    and (a.created_at, a.id) < (b.created_at, b.id);
create unique index if not exists contributions_one_rating_idx
  on public.contributions (user_id, (payload ->> 'target')) where type = 'rating';

-- Nobody reads or writes the table directly: the functions below do it and never return user_id.
drop policy if exists "contributions: everyone reads" on public.contributions;
drop policy if exists "contributions: signed-in users add their own" on public.contributions;
drop policy if exists "contributions: authors and admins delete" on public.contributions;
revoke all on public.contributions from anon, authenticated;

create or replace function public.preuet_schema()
returns integer
language sql
immutable
as $$ select 2 $$;
grant execute on function public.preuet_schema() to anon, authenticated;

create or replace function public.list_contributions(p_since timestamptz default now() - interval '120 days', p_limit integer default 3000)
returns table (id uuid, type text, payload jsonb, created_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.type, c.payload, c.created_at, coalesce(c.user_id = auth.uid(), false)
  from public.contributions c
  where c.created_at >= coalesce(p_since, now() - interval '120 days')
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 3000), 1), 5000);
$$;
revoke all on function public.list_contributions(timestamptz, integer) from public;
grant execute on function public.list_contributions(timestamptz, integer) to anon, authenticated;

create or replace function public.add_contribution(p_type text, p_payload jsonb)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Cal una sessió per fer aportacions' using errcode = '42501';
  end if;
  return query
    insert into public.contributions as c (type, payload)
    values (p_type, coalesce(p_payload, '{}'::jsonb))
    returning c.id, c.created_at;
end;
$$;
revoke all on function public.add_contribution(text, jsonb) from public, anon;
grant execute on function public.add_contribution(text, jsonb) to authenticated;

create or replace function public.delete_contribution(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.contributions c
    where c.id = p_id and (c.user_id = auth.uid() or public.is_admin());
  return found;
end;
$$;
revoke all on function public.delete_contribution(uuid) from public, anon;
grant execute on function public.delete_contribution(uuid) to authenticated;

-- Live updates: each new or deleted item is broadcast (without the author) on the public topic preuet:contributions.
-- If Realtime is not available the insert still works; the app also re-reads the feed every 5 minutes.
create or replace function public.contributions_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform realtime.send(jsonb_build_object('id', new.id, 'type', new.type, 'payload', new.payload, 'created_at', new.created_at),
                            'insert', 'preuet:contributions', false);
    else
      perform realtime.send(jsonb_build_object('id', old.id), 'delete', 'preuet:contributions', false);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$$;
drop trigger if exists contributions_broadcast on public.contributions;
create trigger contributions_broadcast
  after insert or delete on public.contributions
  for each row execute function public.contributions_broadcast();

-- version 1 published the table itself to Realtime (which showed user_id): take it out
do $$
begin
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'contributions') then
    alter publication supabase_realtime drop table public.contributions;
  end if;
end;
$$;

-- ---------- estat privat de cada usuari ----------
create table if not exists public.user_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 200000),
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;

drop policy if exists "user_state: owner reads" on public.user_state;
create policy "user_state: owner reads" on public.user_state
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "user_state: owner inserts" on public.user_state;
create policy "user_state: owner inserts" on public.user_state
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "user_state: owner updates" on public.user_state;
create policy "user_state: owner updates" on public.user_state
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "user_state: owner deletes" on public.user_state;
create policy "user_state: owner deletes" on public.user_state
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.user_state from anon, authenticated;
grant select, insert, update, delete on public.user_state to authenticated;

-- ---------- proves de solució S01–S10 (només l'equip) ----------
create table if not exists public.solution_tests (
  code text primary key check (code ~ '^S(0[1-9]|10)$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 50000),
  saved_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.solution_tests enable row level security;   -- no policies: only the functions below reach it
revoke all on public.solution_tests from anon, authenticated;

create table if not exists public.team_secret (
  id boolean primary key default true check (id),
  key_hash text not null
);
alter table public.team_secret enable row level security;      -- no policies
revoke all on public.team_secret from anon, authenticated;

-- run from the SQL editor only
create or replace function public.set_team_key(new_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(coalesce(new_key, '')) < 8 then
    raise exception 'El codi d''equip ha de tenir almenys 8 caràcters';
  end if;
  insert into public.team_secret (id, key_hash)
    values (true, extensions.crypt(new_key, extensions.gen_salt('bf')))
  on conflict (id) do update set key_hash = excluded.key_hash;
end;
$$;
revoke all on function public.set_team_key(text) from public, anon, authenticated;

create or replace function public.team_key_ok(team_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_secret s
    where s.key_hash = extensions.crypt(coalesce(team_key, ''), s.key_hash)
  );
$$;
revoke all on function public.team_key_ok(text) from public, anon, authenticated;

create or replace function public.save_test(p_code text, p_data jsonb, team_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.team_key_ok(team_key) then
    raise exception 'Codi d''equip incorrecte' using errcode = '28000';
  end if;
  insert into public.solution_tests (code, data, saved_by, updated_at)
    values (p_code, p_data, auth.uid(), now())
  on conflict (code) do update
    set data = excluded.data, saved_by = excluded.saved_by, updated_at = now();
end;
$$;
revoke all on function public.save_test(text, jsonb, text) from public, anon;
grant execute on function public.save_test(text, jsonb, text) to authenticated;

create or replace function public.list_tests(team_key text)
returns table (code text, data jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.team_key_ok(team_key) then
    raise exception 'Codi d''equip incorrecte' using errcode = '28000';
  end if;
  return query select t.code, t.data from public.solution_tests t order by t.code;
end;
$$;
revoke all on function public.list_tests(text) from public, anon;
grant execute on function public.list_tests(text) to authenticated;

-- ---------- neteja (cada nit amb pg_cron, si està activat) ----------
create or replace function public.cleanup_old()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.contributions where created_at < now() - interval '120 days';
  -- anonymous users with no saved state and no contribution in 180 days (their basket, if any, is long gone)
  delete from auth.users u
    where u.is_anonymous
      and u.created_at < now() - interval '180 days'
      and not exists (select 1 from public.user_state s where s.user_id = u.id and s.updated_at > now() - interval '180 days')
      and not exists (select 1 from public.contributions c where c.user_id = u.id and c.created_at > now() - interval '180 days');
end;
$$;
revoke all on function public.cleanup_old() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('preuet-cleanup', '17 4 * * *', 'select public.cleanup_old()');
  end if;
end;
$$;
