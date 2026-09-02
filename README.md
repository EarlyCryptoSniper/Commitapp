# LockIn — Phase 1

Habit commitment tool. Geen kansspel. Geen pot, geen odds, geen winst van anderen.
V1 schrijft geen geld af.

## Stack

- React + TypeScript + Vite + Tailwind
- Supabase: Auth, Postgres, RLS, Storage
- Schrijven alleen via RPCs

## Lokaal starten

```bash
cp .env.example .env.local
# vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Gebruik **alleen** de anon/publishable key. Nooit de service-role key in deze app.

## Supabase — handmatige stappen

1. Nieuw project op https://supabase.com
2. Authentication → Providers: Email aan
3. Authentication → URL configuration:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173/**`
4. SQL Editor: plak en run
   `supabase/migrations/20260902120000_phase1_foundation.sql`
5. Database → Extensions: zet `pg_cron` aan als je automatische expiry wilt.
   Zonder cron expire’t de app nog steeds als iemand het dashboard opent.
6. Storage: bucket `commitment-proofs` wordt door de migratie aangemaakt (privé).
   Upload-UI volgt in phase 2.

## Statusmachine

```
draft --lock--> locked --foto op tijd--> completed
                     \--deadline--> failed
```

Geen `charged`. Geen terug-transities.

## RPCs

| Functie | Doel |
|---|---|
| `create_commitment_draft` | Rij aanmaken, status draft |
| `lock_commitment` | Tekenen, `signed_at = now()` |
| `finalize_proof` | Foto-pad vastleggen, completed |
| `delete_draft` | Alleen eigen draft weg |
| `expire_due_commitments` | locked + deadline voorbij → failed |

## Phase 1 bewust niet gebouwd

- Commitment-wizard uit de video
- Foto-upload
- Stripe / Mollie
- Video, GPS, timelapse
- Landing-wow

## Phase 2

Wizard: €5/€10 → taak → deadline → samenvatting → tekenen → Vastgezet.
Daarna foto-upload naar `{user_id}/{commitment_id}/{uuid}.jpg`.
