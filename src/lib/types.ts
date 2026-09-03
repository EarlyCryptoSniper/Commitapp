export type TaskId =
  | "meditate"
  | "workout"
  | "no_takeaway"
  | "stretch"
  | "tiktok_max_1h"
  | "pushups_10"
  | "desk_admin";

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

export type EvidenceContract = {
  pass: string;
  fail: string;
  insufficient: string;
  challenge: string;
};

export type TaskDef = {
  id: TaskId;
  label: string;
  proofType: ProofType;
  proofLabel: string;
  hint: string;
  contract: EvidenceContract;
};

export const TASKS: TaskDef[] = [
  {
    id: "desk_admin",
    label: "Bureau afronden",
    proofType: "photo_pair",
    proofLabel: "Foto voor + na",
    hint: "Eerst de startsituatie, daarna het resultaat met challenge in beeld.",
    contract: {
      pass: "Zelfde plek. Voor rommelig of open. Na leger. Challenge leesbaar en geldig.",
      fail: "Na gelijk of erger, andere ruimte, of verlopen/ontbrekende challenge.",
      insufficient: "Te donker, andere hoek, challenge onleesbaar, of voor-foto ontbreekt.",
      challenge: "Na-foto via LockIn-camera. Code 10 min geldig.",
    },
  },
  {
    id: "pushups_10",
    label: "10 keer opdrukken",
    proofType: "video",
    proofLabel: "Video",
    hint: "Eén ononderbroken video. Challenge in de eerste seconden.",
    contract: {
      pass: "Eén take. Challenge vooraan geldig. Ongeveer 10 herhalingen zichtbaar.",
      fail: "Geen oefening, duidelijk geknipt, of andere oefening.",
      insufficient: "Telling onzeker, lichaam half buiten beeld, of challenge onleesbaar.",
      challenge: "Video via LockIn-camera. Code 10 min geldig, vooraan in beeld.",
    },
  },
  {
    id: "meditate",
    label: "10 min mediteren",
    proofType: "photo",
    proofLabel: "Foto",
    hint: "Timer of app ≥10:00 plus challenge in hetzelfde kader.",
    contract: {
      pass: "Leesbare timer van minstens 10 minuten en geldige challenge.",
      fail: "Timer onder 10 minuten of geen tijd zichtbaar.",
      insufficient: "Cijfers onleesbaar of challenge weg.",
      challenge: "Foto via LockIn-camera. Code 10 min geldig, in hetzelfde kader.",
    },
  },
];

export const TASK_LABELS: Record<TaskId, string> = {
  meditate: "10 min mediteren",
  workout: "Sporten",
  no_takeaway: "Geen takeaway",
  stretch: "Stretchen",
  tiktok_max_1h: "Max 1 uur TikTok",
  pushups_10: "10 keer opdrukken",
  desk_admin: "Bureau afronden",
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

export const ALLOWED_AMOUNTS = [500, 1000] as const;
export const ALLOWED_TASKS = TASKS.map((t) => t.id);

export function taskDef(id: TaskId): TaskDef | undefined {
  return TASKS.find((t) => t.id === id);
}