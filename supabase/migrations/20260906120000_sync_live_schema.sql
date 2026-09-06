-- P0b snapshot: make GitHub match LIVE Commitapp schema.
-- Do NOT run this on production. These objects already exist there.
-- Additive / idempotent against 20260902120000_phase1_foundation.sql

-- Extra columns found live (udt = text / timestamptz)
alter table public.commitments
  add column if not exists challenge_code text,
  add column if not exists challenge_expires_at timestamptz,
  add column if not exists promise_text text,
  add column if not exists evidence_rule text;

-- Live table missing from phase-1 migration
create table if not exists public.verdicts (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  model text not null,
  result text not null,
  checklist jsonb not null default '{}'::jsonb,
  raw_response text,
  created_at timestamptz not null default now()
);

create index if not exists verdicts_commitment_id_idx
  on public.verdicts (commitment_id);

-- Live RPCs (bodies dumped 2026-09-06 from production)

create or replace function public.apply_verdict(
  p_commitment_id uuid,
  p_model text,
  p_result text,
  p_checklist jsonb,
  p_raw text default null
)
returns public.commitments
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row public.commitments;
  v_status text;
begin
  if p_result not in ('passed', 'failed', 'insufficient') then
    raise exception 'invalid verdict';
  end if;

  select * into v_row
  from public.commitments
  where id = p_commitment_id
  for update;

  if not found then
    raise exception 'commitment not found';
  end if;

  if v_row.status <> 'reviewing' then
    raise exception 'commitment is not reviewing';
  end if;

  insert into public.verdicts (
    commitment_id, model, result, checklist, raw_response
  ) values (
    p_commitment_id, coalesce(p_model, 'unknown'), p_result,
    coalesce(p_checklist, '{}'::jsonb), p_raw
  );

  v_status := case p_result
    when 'passed' then 'completed'
    when 'failed' then 'failed'
    else 'insufficient_evidence'
  end;

  update public.commitments
  set status = v_status
  where id = p_commitment_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.create_commitment_draft(
  p_amount_cents integer,
  p_deadline timestamptz,
  p_promise_text text,
  p_evidence_rule text,
  p_proof_type text default 'photo',
  p_timezone text default 'Europe/Amsterdam'
)
returns public.commitments
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.commitments;
  v_promise text := trim(p_promise_text);
  v_rule text := trim(p_evidence_rule);
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount_cents not in (500, 1000) then raise exception 'invalid amount'; end if;
  if char_length(v_promise) < 8 or char_length(v_promise) > 280 then
    raise exception 'promise length';
  end if;
  if char_length(v_rule) < 8 or char_length(v_rule) > 400 then
    raise exception 'evidence rule length';
  end if;
  if p_proof_type not in ('photo', 'photo_pair', 'video') then
    raise exception 'invalid proof type';
  end if;
  if p_deadline <= now() then raise exception 'deadline must be in the future'; end if;

  insert into public.commitments (
    user_id, amount_cents, task, deadline, timezone, proof_type, status,
    promise_text, evidence_rule
  )
  values (
    v_uid, p_amount_cents, 'custom', p_deadline,
    coalesce(nullif(p_timezone, ''), 'Europe/Amsterdam'),
    p_proof_type, 'draft', v_promise, v_rule
  )
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.delete_draft(p_commitment_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
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
$function$;

create or replace function public.expire_due_commitments()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
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
$function$;

create or replace function public.finalize_proof(
  p_commitment_id uuid,
  p_storage_path text
)
returns public.commitments
language plpgsql
security definer
set search_path to ''
as $function$
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
  set status = 'reviewing'
  where id = p_commitment_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.issue_challenge(p_commitment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.commitments;
  v_code text;
  v_expires timestamptz;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
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

  if v_row.status <> 'locked' then
    raise exception 'challenge only for locked commitments';
  end if;

  if v_row.challenge_code is not null
     and v_row.challenge_expires_at is not null
     and v_row.challenge_expires_at > now() then
    return jsonb_build_object(
      'code', v_row.challenge_code,
      'expires_at', v_row.challenge_expires_at
    );
  end if;

  v_code := '';
  for i in 1..4 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;

  v_expires := now() + interval '10 minutes';

  update public.commitments
  set challenge_code = v_code,
      challenge_expires_at = v_expires
  where id = p_commitment_id;

  return jsonb_build_object(
    'code', v_code,
    'expires_at', v_expires
  );
end;
$function$;

create or replace function public.lock_commitment(p_commitment_id uuid)
returns public.commitments
language plpgsql
security definer
set search_path to ''
as $function$
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
$function$;

create or replace function public.proof_type_for_task(p_task text)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
begin
  return case p_task
    when 'pushups_10' then 'video'
    when 'workout' then 'video'
    when 'desk_admin' then 'photo_pair'
    else 'photo'
  end;
end;
$function$;

create or replace function public.retry_proof(p_commitment_id uuid)
returns public.commitments
language plpgsql
security definer
set search_path to ''
as $function$
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
  if v_row.status not in ('insufficient_evidence', 'failed') then
    raise exception 'retry not allowed';
  end if;
  if now() > v_row.deadline then
    raise exception 'deadline passed';
  end if;

  delete from public.proofs where commitment_id = p_commitment_id;

  update public.commitments
  set status = 'locked',
      challenge_code = null,
      challenge_expires_at = null
  where id = p_commitment_id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.profiles
  set email = coalesce(new.email, '')
  where id = new.id;
  return new;
end;
$function$;
