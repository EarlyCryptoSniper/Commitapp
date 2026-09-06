-- V1: new LockIns may only be photo or photo_pair.
-- Video (and any other proof type) is rejected at create_commitment_draft.
-- Existing rows with proof_type = video are left unchanged.

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
  if p_proof_type not in ('photo', 'photo_pair') then
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