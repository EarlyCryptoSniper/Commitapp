export type TaskId =
  | "meditate"
  | "workout"
  | "no_takeaway"
  | "stretch"
  | "tiktok_max_1h"
  | "pushups_10"
  | "desk_admin"
  | "show_code"
  | "custom";

export type ProofType = "photo" | "photo_pair" | "video";

export type CommitmentStatus =
  | "draft"
  | "locked"
  | "reviewing"
  | "completed"
  | "insufficient_evidence"
  | "failed";

export type Profile = {
  id: string;
  email: string;
  created_at: string;
};

export type Commitment = {
  id: string;
  user_id: string;
  amount_cents: 500 | 1000;
  task: TaskId | string;
  promise_text: string | null;
  evidence_rule: string | null;
  deadline: string;
  timezone: string;
  proof_type: ProofType;
  status: CommitmentStatus;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Proof = {
  id: string;
  commitment_id: string;
  storage_path: string;
  submitted_at: string;
};

export const PROOF_LABELS: Record<ProofType, string> = {
  photo: "Foto",
  photo_pair: "Foto voor + na",
  video: "Video",
};

export const STATUS_LABELS: Record<CommitmentStatus, string> = {
  draft: "Concept",
  locked: "Wacht op bewijs",
  reviewing: "In beoordeling",
  completed: "Voltooid",
  insufficient_evidence: "Onvoldoende bewijs",
  failed: "Mislukt",
};

export const TASK_LABELS: Record<string, string> = {
  meditate: "10 min mediteren",
  workout: "Sporten",
  no_takeaway: "Geen takeaway",
  stretch: "Stretchen",
  tiktok_max_1h: "Max 1 uur TikTok",
  pushups_10: "10 keer opdrukken",
  desk_admin: "Bureau afronden",
  show_code: "Toon de code",
  custom: "Eigen belofte",
};

export const ALLOWED_AMOUNTS = [500, 1000] as const;

export function commitmentTitle(item: {
  promise_text?: string | null;
  task: string;
}): string {
  const text = item.promise_text?.trim();
  if (text) return text;
  return TASK_LABELS[item.task] ?? item.task;
}