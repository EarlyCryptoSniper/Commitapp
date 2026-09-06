-- Gate finalize_proof on the live challenge code.
-- Do NOT run on production from this agent. Apply later by Menno.

drop function if exists public.finalize_proof(uuid, text);

create or replace function public.finalize_proof(
  p_commitment_id uuid,
  p_storage_path text,
  p_challenge_code text
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

  if p_challenge_code is null or length(p_challenge_code) = 0 then
    raise exception 'challenge required';
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

  if v_row.challenge_code is null
     or v_row.challenge_expires_at is null
     or v_row.challenge_expires_at <= now() then
    raise exception 'challenge expired';
  end if;

  if p_challenge_code <> v_row.challenge_code then
    raise exception 'challenge mismatch';
  end if;

  insert into public.proofs (commitment_id, storage_path)
  values (p_commitment_id, p_storage_path);

  update public.commitments
  set status = 'reviewing',
      challenge_code = null,
      challenge_expires_at = null
  where id = p_commitment_id
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.finalize_proof(uuid, text, text) from public, anon;
grant execute on function public.finalize_proof(uuid, text, text) to authenticated;