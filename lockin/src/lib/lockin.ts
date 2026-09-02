import { requireSupabase } from "./supabase";
import type { Commitment, Profile, TaskId } from "./types";

export async function fetchProfile(): Promise<Profile | null> {
  const db = requireSupabase();
  const { data: sessionData } = await db.auth.getUser();
  const user = sessionData.user;
  if (!user) return null;

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as Profile;

  return {
    id: user.id,
    email: user.email ?? "",
    created_at: user.created_at,
  };
}

export async function expireDueCommitments(): Promise<number> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("expire_due_commitments");
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function fetchCommitments(): Promise<Commitment[]> {
  const db = requireSupabase();
  await expireDueCommitments().catch(() => undefined);

  const { data, error } = await db
    .from("commitments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Commitment[];
}

export async function fetchCommitment(id: string): Promise<Commitment | null> {
  const db = requireSupabase();
  await expireDueCommitments().catch(() => undefined);

  const { data, error } = await db
    .from("commitments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as Commitment | null) ?? null;
}

export async function createCommitmentDraft(input: {
  amountCents: 500 | 1000;
  task: TaskId;
  deadlineIso: string;
  timezone?: string;
}): Promise<Commitment> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("create_commitment_draft", {
    p_amount_cents: input.amountCents,
    p_task: input.task,
    p_deadline: input.deadlineIso,
    p_timezone: input.timezone ?? "Europe/Amsterdam",
  });
  if (error) throw error;
  return data as Commitment;
}

export async function lockCommitment(id: string): Promise<Commitment> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("lock_commitment", {
    p_commitment_id: id,
  });
  if (error) throw error;
  return data as Commitment;
}

export async function deleteDraft(id: string): Promise<void> {
  const db = requireSupabase();
  const { error } = await db.rpc("delete_draft", { p_commitment_id: id });
  if (error) throw error;
}

export async function finalizeProof(
  id: string,
  storagePath: string
): Promise<Commitment> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("finalize_proof", {
    p_commitment_id: id,
    p_storage_path: storagePath,
  });
  if (error) throw error;
  return data as Commitment;
}
