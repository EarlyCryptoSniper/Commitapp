-- Handmatige checks in SQL editor (twee testusers A en B).
-- Verwacht: permission denied / not allowed / 0 rows.

-- 1. Anoniem mag niks zien
-- (in een incognito client zonder session)
-- select * from public.commitments;

-- 2. User A leest User B niet
-- select * from public.commitments where user_id = '<user-b-id>';

-- 3. Directe status-update moet falen (geen grant)
-- update public.commitments set status = 'completed' where id = '<own-id>';

-- 4. lock_commitment op andermans rij
-- select public.lock_commitment('<user-b-commitment-id>');

-- 5. Ongeldig bedrag
-- select public.create_commitment_draft(700, 'workout', now() + interval '1 day');

-- 6. Ongeldige taak
-- select public.create_commitment_draft(500, 'gokken', now() + interval '1 day');

-- 7. Dubbele proof
-- twee keer finalize_proof op dezelfde locked rij

-- 8. Proof na deadline
-- finalize_proof op een locked rij waarvan deadline <= now()
-- verwacht: status failed + exception

-- 9. Cron / expire
-- select public.expire_due_commitments();
-- locked + deadline verstreken => failed
-- completed blijft completed
