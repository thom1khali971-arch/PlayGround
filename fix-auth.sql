-- ============================================================
-- MiikaCord — correção do cadastro de novos usuários
-- Erro: 500 "Database error saving new user"
--
-- Execute este arquivo no SQL Editor do Supabase:
-- Dashboard > SQL Editor > New query > Run
--
-- A causa mais comum é um trigger em auth.users que tenta criar
-- o perfil em public.profiles e falha por RLS, search_path ou
-- por uma coluna ausente. Este script recria o trigger de forma
-- segura e idempotente.
-- ============================================================

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Perfis
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  color text default '#5865f2',
  status text default 'Online',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists color text default '#5865f2';
alter table public.profiles add column if not exists status text default 'Online';
alter table public.profiles add column if not exists created_at timestamptz default now();

alter table public.profiles alter column color set default '#5865f2';
alter table public.profiles alter column status set default 'Online';
alter table public.profiles alter column created_at set default now();

update public.profiles set color = '#5865f2' where color is null;
update public.profiles set status = 'Online' where status is null;
update public.profiles set created_at = now() where created_at is null;

-- ------------------------------------------------------------
-- 2. Trigger de criação do perfil
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'username'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'Usuário'
  );

  -- A checagem evita depender de uma constraint única em profiles.id.
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id, username, color, status)
    values (new.id, left(display_name, 32), '#5865f2', 'Online');
  end if;

  return new;

exception
  when others then
    -- Nunca bloqueia o cadastro em auth.users. O erro fica registrado
    -- nos logs do Postgres para diagnóstico.
    raise warning 'handle_new_user falhou para %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 3. Permissões e RLS de profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ------------------------------------------------------------
-- 4. Canais
-- ------------------------------------------------------------
create table if not exists public.channels (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.channels add column if not exists name text;
alter table public.channels add column if not exists created_at timestamptz default now();
alter table public.channels alter column created_at set default now();

alter table public.channels enable row level security;
grant select on public.channels to authenticated;

drop policy if exists "channels_select_authenticated" on public.channels;
create policy "channels_select_authenticated"
on public.channels for select
to authenticated
using (true);

-- Semeia apenas o canal geral e remove os demais canais.
do $$
declare
  id_type text;
begin
  select data_type into id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'channels'
    and column_name = 'id';

  if id_type in ('text', 'character varying', 'character') then
    insert into public.channels (id, name)
    select 'geral', 'geral'
    where not exists (select 1 from public.channels where id = 'geral' or name = 'geral');
  end if;
end;
$$;

-- Mantém somente o canal geral, apagando as mensagens dos outros canais.
do $$
begin
  if exists (select 1 from public.channels where id::text = 'geral' or name = 'geral') then
    if to_regclass('public.messages') is not null then
      delete from public.messages
      where channel_id is not null
        and channel_id::text not in (
          select id::text from public.channels where id::text = 'geral' or name = 'geral'
        );
    end if;

    delete from public.channels
    where not (id::text = 'geral' or name = 'geral');
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 5. Mensagens
-- ------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text,
  username text,
  color text default '#5865f2',
  content text,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists channel_id text;
alter table public.messages add column if not exists username text;
alter table public.messages add column if not exists color text default '#5865f2';
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists created_at timestamptz default now();
alter table public.messages alter column created_at set default now();

update public.messages set color = '#5865f2' where color is null;
update public.messages set created_at = now() where created_at is null;

create index if not exists messages_channel_created_idx
on public.messages (channel_id, created_at);

alter table public.messages enable row level security;
grant select, insert on public.messages to authenticated;

drop policy if exists "messages_select_authenticated" on public.messages;
create policy "messages_select_authenticated"
on public.messages for select
to authenticated
using (true);

drop policy if exists "messages_insert_authenticated" on public.messages;
create policy "messages_insert_authenticated"
on public.messages for insert
to authenticated
with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 6. Realtime
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'messages'
     ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
exception
  when others then
    raise warning 'Não foi possível adicionar messages ao Realtime: %', sqlerrm;
end;
$$;

commit;

-- ------------------------------------------------------------
-- Verificação rápida (deve retornar o trigger criado):
-- ------------------------------------------------------------
-- select tgname, pg_get_triggerdef(oid)
-- from pg_trigger
-- where tgrelid = 'auth.users'::regclass
--   and not tgisinternal;
