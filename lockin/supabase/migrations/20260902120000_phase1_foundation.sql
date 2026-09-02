-- LockIn Phase 1 foundation
-- Apply in Supabase SQL editor if the CLI is not used.
-- Never put a service-role key in the frontend.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents integer not null,
  task text not null,
  deadline timestamptz not null,
  timezone text not null default 'Europe/Amsterdam',
  proof_type text not null default 'photo',
  status text not null default 'draft',
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commitments_amount_chk check (amount_cents in (500, 1000)),
  constraint commitments_task_chk check (
    task in ('meditate', 'workout', 'no_takeaway', 'stretch', 'tiktok_max_1h')
  ),
  constraint commitments_proof_chk check (proof_type = 'photo'),
  constraint commitments_status_chk check (
    status in ('draft', 'locked', 'completed', 'failed')
  )
);

create table if not exists public.proofs (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null unique references public.commitments (id) on delete cascade,
  storage_path text not null unique,
  submitted_at timestamptz not null default now()
);

create index if not exists commitments_user_created_idx
  on public.commitments (user_id, created_at desc);

create index if not exists commitments_user_status_idx
  on public.commitments (user_id, status);

create index if not exists commitments_locked_deadline_idx
  on public.commitments (deadline)
  where status = 'locked';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists commitments_set_updated_at on public.commitments;
create trigger commitments_set_updated_at
before update on public.commitments
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile from auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(new.email, '')
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
execute function public.sync_profile_email();

-- ---------------------------------------------------------------------------
-- Grants: clients may only SELECT. Writes go through RPCs.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.commitments enable row level security;
alter table public.proofs enable row level security;

revoke all on table public.profiles from anon, authenticated, public;
revoke all on table public.commitments from anon, authenticated, public;
revoke all on table public.proofs from anon, authenticated, public;

grant select on table public.profiles to authenticated;
grant select on table public.commitments to authenticated;
grant select on table public.proofs to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

drop policy if exists commitments_select_own on public.commitments;
create policy commitments_select_own
on public.commitments
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists proofs_select_own on public.proofs;
create policy proofs_select_own
on public.proofs
for select
to authenticated
using (
  exists (
    select 1
    from public.commitments c
    where c.id = proofs.commitment_id
      and c.user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_commitment_draft(
  p_amount_cents integer,
  p_task text,
  p_deadline timestamptz,
  p_timezone text default 'Europe/Amsterdam'
)
returns public.commitments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.commitments;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_amount_cents not in (500, 1000) then
    raise exception 'invalid amount';
  end if;

  if p_task not in ('meditate', 'workout', 'no_takeaway', 'stretch', 'tiktok_max_1h') then
    raise exception 'invalid task';
  end if;

  if p_deadline <= now() then
    raise exception 'deadline must be in the future';
  end if;

  insert into public.commitments (
    user_id, amount_cents, task, deadline, timezone, proof_type, status
  )
  values (
    v_uid, p_amount_cents, p_task, p_deadline,
    coalesce(nullif(p_timezone, ''), 'Europe/Amsterdam'),
    'photo', 'draft'
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.lock_commitment(p_commitment_id uuid)
returns public.commitments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.commitments;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row
  from public.commitments
  where id = p_commitment_id
  for update;

  if not found then
    raise exception 'commitment not found';
  end if;

  if v_row.user_id <> v_uid then
    raise exception 'not allowed';
  end if;

  if v_row.status <> 'draft' then
    raise exception 'commitment is not a draft';
  end if;

  if v_row.deadline <= now() then
    raise exception 'deadline already passed';
  end if;

  update public.commitments
  set status = 'locked', signed_at = now()
  where id = p_commitment_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.delete_draft(p_commitment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.commitments;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row
  from public.commitments
  where id = p_commitment_id
  for update;

  if not found then
    raise exception 'commitment not found';
  end if;

  if v_row.user_id <> v_uid then
    raise exception 'not allowed';
  end if;

  if v_row.status <> 'draft' then
    raise exception 'only drafts can be deleted';
  end if;

  delete from public.commitments where id = p_commitment_id;
end;
$$;

-- Photo upload itself is Phase 2. This RPC is the only way to complete.
create or replace function public.finalize_proof(
  p_commitment_id uuid,
  p_storage_path text
)
returns public.commitments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.commitments;
  v_prefix text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_storage_path is null or length(p_storage_path) < 10 then
    raise exception 'invalid storage path';
  end if;

  v_prefix := v_uid::text || '/' || p_commitment_id::text || '/';
  if left(p_storage_path, length(v_prefix)) <> v_prefix then
    raise exception 'storage path does not match owner and commitment';
  end if;

  select * into v_row
  from public.commitments
  where id = p_commitment_id
  for update;

  if not found then
    raise exception 'commitment not found';
  end if;

  if v_row.user_id <> v_uid then
    raise exception 'not allowed';
  end if;

  if v_row.status <> 'locked' then
    raise exception 'commitment is not waiting for proof';
  end if;

  if now() > v_row.deadline then
    update public.commitments
    set status = 'failed'
    where id = p_commitment_id;
    raise exception 'deadline passed';
  end if;

  insert into public.proofs (commitment_id, storage_path)
  values (p_commitment_id, p_storage_path);

  update public.commitments
  set status = 'completed'
  where id = p_commitment_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Called by cron (all rows) and by the dashboard (same function).
create or replace function public.expire_due_commitments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.commitments
  set status = 'failed'
  where status = 'locked'
    and deadline <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_commitment_draft(integer, text, timestamptz, text) from public, anon;
revoke all on function public.lock_commitment(uuid) from public, anon;
revoke all on function public.delete_draft(uuid) from public, anon;
revoke all on function public.finalize_proof(uuid, text) from public, anon;
revoke all on function public.expire_due_commitments() from public, anon;

grant execute on function public.create_commitment_draft(integer, text, timestamptz, text) to authenticated;
grant execute on function public.lock_commitment(uuid) to authenticated;
grant execute on function public.delete_draft(uuid) to authenticated;
grant execute on function public.finalize_proof(uuid, text) to authenticated;
grant execute on function public.expire_due_commitments() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket (private). Upload policies come in Phase 2 with the photo UI.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commitment-proofs',
  'commitment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read own proof objects only. No generic upload grant in Phase 1.
drop policy if exists proof_objects_select_own on storage.objects;
create policy proof_objects_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'commitment-proofs'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

-- ---------------------------------------------------------------------------
-- Optional cron. Enable "pg_cron" in Database > Extensions first.
-- Safe to skip if the extension is not available; dashboard still expires.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'lockin-expire-due') then
      perform cron.unschedule('lockin-expire-due');
    end if;
    perform cron.schedule(
      'lockin-expire-due',
      '* * * * *',
      'select public.expire_due_commitments();'
    );
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;
