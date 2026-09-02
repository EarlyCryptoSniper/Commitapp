export type TaskId =
  | "meditate"
  | "workout"
  | "no_takeaway"
  | "stretch"
  | "tiktok_max_1h";

export type CommitmentStatus = "draft" | "locked" | "completed" | "failed";

export type ProofType = "photo";

export type Profile = {
  id: string;
  email: string;
  created_at: string;
};

export type Commitment = {
  id: string;
  user_id: string;
  amount_cents: 500 | 1000;
  task: TaskId;
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

export const TASK_LABELS: Record<TaskId, string> = {
  meditate: "Mediteren",
  workout: "Sporten",
  no_takeaway: "Geen takeaway",
  stretch: "Stretchen",
  tiktok_max_1h: "Max 1 uur TikTok",
};

export const STATUS_LABELS: Record<CommitmentStatus, string> = {
  draft: "Concept",
  locked: "Wacht op bewijs",
  completed: "Voltooid",
  failed: "Mislukt",
};

export const ALLOWED_AMOUNTS = [500, 1000] as const;
export const ALLOWED_TASKS: TaskId[] = [
  "meditate",
  "workout",
  "no_takeaway",
  "stretch",
  "tiktok_max_1h",
];
