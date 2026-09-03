import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TASK_CONTRACTS: Record<string, string> = {
  desk_admin:
    "BEFORE and AFTER photos of the same desk. PASS only if same place, before is messy/open, after is clearly emptier, and challenge LOCKIN XXXX is readable on AFTER. FAIL if after is as messy, different room, or code missing. INSUFFICIENT if dark, bad angle, or unreadable.",
  meditate:
    "Photo of a timer/app showing at least 10:00 AND challenge LOCKIN XXXX in the same frame. PASS only if both readable. FAIL if timer under 10 minutes. INSUFFICIENT if unreadable.",
  pushups_10:
    "Video is out of scope. overall must be insufficient.",
};

type VerdictResult = "passed" | "failed" | "insufficient";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) throw new Error("OPENAI_API_KEY missing");

    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new Error("not authenticated");

    const { commitment_id: commitmentId } = await req.json();
    if (!commitmentId) throw new Error("commitment_id required");

    const { data: commitment, error: cErr } = await admin
      .from("commitments")
      .select("*")
      .eq("id", commitmentId)
      .maybeSingle();
    if (cErr || !commitment) throw new Error("commitment not found");
    if (commitment.user_id !== userData.user.id) throw new Error("not allowed");
    if (commitment.status !== "reviewing") {
      return json({ ok: true, skipped: true, status: commitment.status });
    }

    const { data: proof } = await admin
      .from("proofs")
      .select("storage_path")
      .eq("commitment_id", commitmentId)
      .maybeSingle();
    if (!proof?.storage_path) throw new Error("no proof");

    const ext = (proof.storage_path.split(".").pop() ?? "").toLowerCase();
    if (["webm", "mp4", "mov"].includes(ext)) {
      await apply(admin, commitmentId, "insufficient", {
        reason: "Video review is not enabled in this version.",
      });
      return json({ ok: true, result: "insufficient" });
    }

    const paths: string[] = [proof.storage_path];
    if (commitment.proof_type === "photo_pair") {
      const folder = proof.storage_path.split("/").slice(0, 2).join("/");
      const { data: objects } = await admin.storage
        .from("commitment-proofs")
        .list(folder);
      for (const obj of objects ?? []) {
        if (obj.name.startsWith("before.")) {
          paths.unshift(`${folder}/${obj.name}`);
        }
      }
    }

    const imageUrls: { url: string }[] = [];
    for (const path of paths) {
      const { data, error } = await admin.storage
        .from("commitment-proofs")
        .createSignedUrl(path, 120);
      if (error || !data?.signedUrl) continue;
      imageUrls.push({ url: data.signedUrl });
    }
    if (imageUrls.length === 0) throw new Error("could not sign proof");

    const challenge = commitment.challenge_code
      ? `LOCKIN ${commitment.challenge_code}`
      : "unknown";
    const contract =
      TASK_CONTRACTS[commitment.task] ??
      "If unsure return insufficient. Never guess.";

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "LockIn referee. Judge only the contract. JSON keys: overall, checklist, reason. overall is passed, failed, or insufficient.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Contract:\n${contract}\nChallenge: ${challenge}\nDo not judge the deadline.`,
              },
              ...imageUrls.map((img) => ({
                type: "image_url",
                image_url: { url: img.url },
              })),
            ],
          },
        ],
      }),
    });

    const raw = await ai.text();
    if (!ai.ok) throw new Error(`openai ${ai.status}: ${raw.slice(0, 300)}`);

    const parsed = JSON.parse(raw) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = parsed.choices?.[0]?.message?.content ?? "{}";
    const verdict = JSON.parse(content) as { overall?: string };
    const overall = normalize(verdict.overall);
    await apply(admin, commitmentId, overall, { raw: content });
    return json({ ok: true, result: overall });
  } catch (err) {
    const message = err instanceof Error ? err.message : "review failed";
    return json({ ok: false, error: message }, 400);
  }
});

function normalize(value: string | undefined): VerdictResult {
  const v = (value ?? "").toLowerCase();
  if (v === "passed" || v === "pass") return "passed";
  if (v === "failed" || v === "fail") return "failed";
  return "insufficient";
}

async function apply(
  admin: ReturnType<typeof createClient>,
  commitmentId: string,
  result: VerdictResult,
  extra: Record<string, unknown>
) {
  const { error } = await admin.rpc("apply_verdict", {
    p_commitment_id: commitmentId,
    p_model: "gpt-4o-mini",
    p_result: result,
    p_checklist: extra,
    p_raw: typeof extra.raw === "string" ? extra.raw : JSON.stringify(extra),
  });
  if (error) throw new Error(error.message);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
}