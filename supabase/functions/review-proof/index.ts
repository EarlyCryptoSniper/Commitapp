import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type VerdictResult = "passed" | "failed" | "insufficient";

const DISALLOWED =
  /geweld|moord|verkracht|zelfmoord|zelfbeschadiging|minderjarig|child.?sex|exploitatie|terror|bom|drug deal|haatzaai/i;

const NEGATIVE =
  /\b(geen|niet|nooit)\s+(meer\s+)?(takeaway|thuisbezorgd|alcohol|roken|sigaret|drugs|tiktok|snoep|fastfood|bestellen)\b|\bik\s+(doe|ga|zal|eet|drink|kijk|gebruik)\s+(geen|niet|nooit)\b|\bnooit\s+meer\b/i;

const HEDGE =
  /onzeker|twijfel|misschien|waarschijnlijk|lijkt|kan zijn|ongeveer|niet duidelijk|moeilijk te zien|denk ik/i;

const TASK_NL: Record<string, string> = {
  workout: "Sporten",
  desk: "Bureau afronden",
  meditate: "10 min mediteren",
  pushups: "10 keer opdrukken",
  custom: "Eigen belofte",
};

/**
 * VIDEO POLICY (Path B): gpt-4o-mini vision has no reliable video input
 * in this edge stack (no ffmpeg frames). Video proofs → insufficient + NL.
 *
 * False-PASS (2026-09-05): a balcony object was marked passed while it did
 * not match the frozen belofte/bewijseis. Prefer insufficient over passed.
 */

const SYSTEM = `Je bent een strenge LockIn-scheidsrechter. Antwoord ALLEEN als JSON-object met keys overall en reason. overall is alleen "passed", "failed" of "insufficient". reason is één korte Nederlandse zin. Geen Engels. Geen extra keys. JSON.

passed ALLEEN als BEIDE waar zijn:
1) De foto toont overduidelijk de belofte volgens de bewijseis.
2) De LOCKIN-code is leesbaar als die vereist is.

NOOIT passed als:
- de code zichtbaar is maar de belofte niet
- een willekeurig voorwerp, balkon, kamer of persoon dat niet de belofte is
- de scène "iets" toont dat erop zou kunnen lijken
- je moet raden wat de gebruiker bedoelde
- de foto ongerelateerd is

Voorbeelden (anti-cadeau-PASS):
- Belofte "bureau afruimen", foto van een plant op een balkon → insufficient
- Belofte "10 keer opdrukken", foto met alleen LOCKIN-code → insufficient
- Belofte "mediteren 10 min", willekeurige selfie zonder timer/houding → insufficient

failed ALLEEN als het beeld aantoont dat de belofte NIET is nagekomen (zelfde plek duidelijk niet gedaan).
Twijfel, andere plek, onleesbaar, of "zou kunnen" → insufficient. Nooit cadeau-PASS.`;

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

    const promise =
      String(commitment.promise_text ?? "").trim() ||
      TASK_NL[String(commitment.task ?? "")] ||
      String(commitment.task ?? "");
    const rule = String(commitment.evidence_rule ?? "").trim();
    const blob = `${promise} ${rule}`;

    if (DISALLOWED.test(blob) || NEGATIVE.test(promise)) {
      await apply(admin, commitmentId, "insufficient", {
        reason: "Deze belofte of dit bewijs laten we niet toe.",
      });
      return json({ ok: true, result: "insufficient" });
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
        reason:
          "Video kan niet worden beoordeeld. Gebruik een foto of foto voor + na.",
      });
      return json({ ok: true, result: "insufficient" });
    }

    const folder = proof.storage_path.split("/").slice(0, 2).join("/");
    const paths: string[] = [];
    if (commitment.proof_type === "photo_pair") {
      const { data: objects } = await admin.storage
        .from("commitment-proofs")
        .list(folder);
      const before = (objects ?? []).find((o) => o.name.startsWith("before."));
      const after = (objects ?? []).find((o) => o.name.startsWith("after."));
      if (before) paths.push(`${folder}/${before.name}`);
      if (after) paths.push(`${folder}/${after.name}`);
      if (paths.length < 2) {
        await apply(admin, commitmentId, "insufficient", {
          reason: "Voor- of na-foto ontbreekt.",
        });
        return json({ ok: true, result: "insufficient" });
      }
    } else {
      paths.push(proof.storage_path);
    }

    const imageUrls: { url: string }[] = [];
    for (const path of paths) {
      const { data, error } = await admin.storage
        .from("commitment-proofs")
        .createSignedUrl(path, 120);
      if (error || !data?.signedUrl) continue;
      imageUrls.push({ url: data.signedUrl });
    }
    if (imageUrls.length === 0) {
      await apply(admin, commitmentId, "insufficient", {
        reason: "Bewijs kon niet worden bekeken. Stuur een nieuwe foto.",
      });
      return json({ ok: true, result: "insufficient" });
    }

    const challenge = commitment.challenge_code
      ? `LOCKIN ${commitment.challenge_code}`
      : "unknown";

    const contract = `Belofte (bevroren):\n${promise || "-"}\n\nBewijseis (bevroren):\n${rule || "-"}\n\nChallenge: ${challenge}\n\nRegels:\n- Beoordeel ALLEEN deze belofte + bewijseis + LOCKIN-code.\n- passed alleen als het beeld de belofte HARD aantoont volgens de bewijseis EN de code leesbaar is als die hoort.\n- failed alleen als het beeld aantoont dat de belofte niet is nagekomen.\n- insufficient bij twijfel, ongerelateerde foto, andere plek, onleesbaar, of code-alleen.\n- LOCKIN-code alleen is nooit passed.\n- Een balkon, plant of willekeurig voorwerp is nooit passed als dat niet de belofte is.`;

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
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${contract}\nEerste beeld is BEFORE, tweede is AFTER (als er twee zijn).\nBeoordeel de deadline niet. Antwoord als JSON.`,
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
    if (!ai.ok) {
      await apply(admin, commitmentId, "insufficient", {
        reason: "Keuring gaf geen geldig antwoord. Stuur opnieuw bewijs.",
      });
      return json({ ok: true, result: "insufficient" });
    }

    let content = "{}";
    try {
      const parsed = JSON.parse(raw) as {
        choices?: { message?: { content?: string } }[];
      };
      content = parsed.choices?.[0]?.message?.content ?? "{}";
    } catch {
      content = "{}";
    }

    const verdict = parseVerdict(content);
    await apply(admin, commitmentId, verdict.overall, {
      reason: verdict.reason,
      raw: content,
    });
    return json({ ok: true, result: verdict.overall });
  } catch (err) {
    const message = err instanceof Error ? err.message : "review failed";
    return json({ ok: false, error: message }, 400);
  }
});

function parseVerdict(content: string): {
  overall: VerdictResult;
  reason: string;
} {
  try {
    const obj = JSON.parse(content) as {
      overall?: string;
      reason?: string;
    };
    let overall = normalize(obj.overall);
    let reason =
      typeof obj.reason === "string" && obj.reason.trim()
        ? obj.reason.trim().slice(0, 240)
        : fallbackReason(overall);
    reason = reason.replace(/\b(PASS|FAIL|PASSED|FAILED)\b/gi, "").trim();
    if (!reason) reason = fallbackReason(overall);

    if (DISALLOWED.test(reason)) {
      return {
        overall: "insufficient",
        reason: "Deze belofte of dit bewijs laten we niet toe.",
      };
    }
    if (overall === "passed" && HEDGE.test(reason)) {
      overall = "insufficient";
      reason = "Het bewijs toont de belofte niet hard genoeg.";
    }
    return { overall, reason };
  } catch {
    return {
      overall: "insufficient",
      reason: "De keuring gaf geen geldig antwoord. Stuur opnieuw bewijs.",
    };
  }
}

function fallbackReason(overall: VerdictResult): string {
  if (overall === "passed") return "De criteria zijn gehaald.";
  if (overall === "failed") return "De criteria zijn aantoonbaar niet gehaald.";
  return "De keuring kon het bewijs niet hard maken.";
}

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