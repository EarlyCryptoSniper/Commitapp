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

export async function issueChallenge(
  commitmentId: string
): Promise<{ code: string; expiresAt: string }> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("issue_challenge", {
    p_commitment_id: commitmentId,
  });
  if (error) throw error;
  const row = data as { code: string; expires_at: string };
  return { code: row.code, expiresAt: row.expires_at };
}

export async function uploadProofFile(input: {
  commitmentId: string;
  file: File;
  slot: "proof" | "before" | "after";
}): Promise<string> {
  const db = requireSupabase();
  const { data: sessionData } = await db.auth.getUser();
  const uid = sessionData.user?.id;
  if (!uid) throw new Error("Niet ingelogd");
  const ext = extFromFile(input.file);
  const path = `${uid}/${input.commitmentId}/${input.slot}.${ext}`;
  const { error } = await db.storage
    .from("commitment-proofs")
    .upload(path, input.file, { upsert: true, contentType: input.file.type });
  if (error) throw error;
  return path;
}

export async function fetchProofSignedUrl(
  commitmentId: string
): Promise<string | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("proofs")
    .select("storage_path")
    .eq("commitment_id", commitmentId)
    .maybeSingle();
  if (error || !data?.storage_path) return null;
  const { data: signed, error: signError } = await db.storage
    .from("commitment-proofs")
    .createSignedUrl(data.storage_path, 60 * 30);
  if (signError || !signed?.signedUrl) return null;
  return signed.signedUrl;
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

export type VerdictRow = {
  result: "passed" | "failed" | "insufficient";
  checklist: Record<string, unknown>;
  raw_response: string | null;
  created_at: string;
};

export async function fetchLatestVerdict(
  commitmentId: string
): Promise<VerdictRow | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from("verdicts")
    .select("result, checklist, raw_response, created_at")
    .eq("commitment_id", commitmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as VerdictRow | null) ?? null;
}

export async function retryProof(id: string): Promise<Commitment> {
  const db = requireSupabase();
  const { data, error } = await db.rpc("retry_proof", {
    p_commitment_id: id,
  });
  if (error) throw error;
  return data as Commitment;
}

export async function requestReview(commitmentId: string): Promise<void> {
  const db = requireSupabase();
  const { data, error } = await db.functions.invoke("review-proof", {
    body: { commitment_id: commitmentId },
  });
  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      const text = await ctx.clone().text();
      throw new Error(text.slice(0, 400) || error.message);
    }
    throw new Error(error.message);
  }
}

function extFromFile(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName) && fromName.length <= 5) {
    return fromName === "jpg" ? "jpg" : fromName;
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/quicktime") return "mov";
  return "bin";
}