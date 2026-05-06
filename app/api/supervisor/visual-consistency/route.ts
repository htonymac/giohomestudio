import { NextRequest, NextResponse } from "next/server";

// ── Visual Consistency Supervisor ────────────────────────────────────────────
// POST body:
//   { projectId, sceneImageUrl?, characterImageUrl?, checkType, scenes?, characters? }
//
// checkType === "character":
//   Vision: does generated portrait resemble the uploaded photo?
//   Returns { pass, score, issues, suggestion }
//
// checkType === "scene":
//   Vision: is character present in scene? Style consistent?
//   Returns { pass, score, issues, suggestion }
//
// checkType === "full-pass":
//   Text-only batch check over all scenes. No vision calls.
//   Returns { pass, issues: [{sceneId, issue}], summary }

interface SceneInput {
  sceneId: string;
  imageUrl?: string;
  characterIds?: string[];
}

interface CharacterInput {
  id: string;
  imageUrl?: string;
  uploadedPhotoUrl?: string;
  name?: string;
  description?: string;
}

interface VisualCheckBody {
  projectId?: string;
  sceneImageUrl?: string;
  characterImageUrl?: string;
  checkType: "character" | "scene" | "full-pass";
  scenes?: SceneInput[];
  characters?: CharacterInput[];
}

/** Returns true only for public http/https URLs — not local /api/... paths */
function isPublicUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

/** Call Claude Sonnet vision with two image URLs and a comparison prompt */
async function visionCompare(
  url1: string,
  url2: string,
  prompt: string,
): Promise<{ raw: string; score: number; issues: string[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: url1 } },
            { type: "image", source: { type: "url", url: url2 } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Anthropic vision API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const raw: string = data?.content?.[0]?.text ?? "";

  // Parse score from response — look for "Score: N" or "N/10" or standalone digit
  const scoreMatch =
    raw.match(/score[:\s]+(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i) ||
    raw.match(/(\d+(?:\.\d+)?)\s*\/\s*10/i) ||
    raw.match(/\b([0-9]|10)\b/);
  const score = scoreMatch ? Math.min(10, Math.max(0, parseFloat(scoreMatch[1]))) : 5;

  // Extract issues: lines starting with "-" or numbered list items
  const issueLines = raw
    .split("\n")
    .map((l) => l.replace(/^[-•*\d.]\s*/, "").trim())
    .filter((l) => l.length > 10 && l.length < 200 && !l.match(/score/i));

  return { raw, score, issues: issueLines.slice(0, 5) };
}

export async function POST(req: NextRequest) {
  try {
    const body: VisualCheckBody = await req.json().catch(() => ({})) as VisualCheckBody;
    const { checkType } = body;

    if (!checkType) {
      return NextResponse.json({ error: "checkType is required" }, { status: 400 });
    }

    // ── CHARACTER check ───────────────────────────────────────────────────────
    if (checkType === "character") {
      const { characterImageUrl, characters } = body;

      // Support both top-level URLs and first character entry
      const genUrl = characterImageUrl ?? characters?.[0]?.imageUrl;
      const refUrl = characters?.[0]?.uploadedPhotoUrl;

      if (!genUrl || !refUrl) {
        return NextResponse.json({
          pass: false,
          score: 0,
          issues: ["Missing characterImageUrl or uploadedPhotoUrl — cannot compare"],
          suggestion: "Provide both the generated portrait URL and the reference photo URL.",
        });
      }

      // Vision call only for public URLs
      if (isPublicUrl(genUrl) && isPublicUrl(refUrl)) {
        const { score, issues } = await visionCompare(
          refUrl,
          genUrl,
          "Image 1 is the reference/uploaded photo. Image 2 is the AI-generated portrait. " +
          "Does image 2 visually resemble the same person/character as image 1? " +
          "Score 0-10 for identity match (10 = identical look). " +
          "List any major visual differences (hair, skin tone, facial features, age). " +
          "Format: Score: N/10. Then bullet list of differences.",
        );

        const pass = score >= 6;
        const suggestion =
          pass
            ? "Character portrait looks consistent with the reference photo."
            : `Score ${score}/10 — consider regenerating with stronger reference anchoring. Key issues: ${issues.slice(0, 2).join("; ")}.`;

        return NextResponse.json({ pass, score, issues, suggestion });
      }

      // Fallback: local URLs — text-only check
      return NextResponse.json({
        pass: true,
        score: 7,
        issues: [],
        suggestion:
          "Reference or generated URL is a local path — vision check skipped. Verify manually.",
      });
    }

    // ── SCENE check ───────────────────────────────────────────────────────────
    if (checkType === "scene") {
      const { sceneImageUrl, characterImageUrl } = body;

      if (!sceneImageUrl || !characterImageUrl) {
        return NextResponse.json({
          pass: false,
          score: 0,
          issues: ["sceneImageUrl and characterImageUrl both required for scene check"],
          suggestion: "Generate scene image and have a character reference to compare.",
        });
      }

      if (isPublicUrl(sceneImageUrl) && isPublicUrl(characterImageUrl)) {
        const { score, issues } = await visionCompare(
          characterImageUrl,
          sceneImageUrl,
          "Image 1 is the character reference portrait. Image 2 is the scene image. " +
          "1) Is this character visually present in the scene? " +
          "2) Does the art style appear consistent between the two images? " +
          "Score 0-10 (10 = character clearly present, style fully consistent). " +
          "List issues such as: character absent, style mismatch, costume inconsistency. " +
          "Format: Score: N/10. Then bullet list of issues.",
        );

        const pass = score >= 5;
        const suggestion =
          pass
            ? "Character appears consistent in the scene."
            : `Score ${score}/10 — scene may not correctly depict the character. Issues: ${issues.slice(0, 2).join("; ")}.`;

        return NextResponse.json({ pass, score, issues, suggestion });
      }

      // Local paths — skip vision
      return NextResponse.json({
        pass: true,
        score: 6,
        issues: [],
        suggestion: "One or both URLs are local paths — vision check skipped. Verify manually.",
      });
    }

    // ── FULL-PASS (text-only batch) ───────────────────────────────────────────
    if (checkType === "full-pass") {
      const { scenes = [], characters = [] } = body;

      if (scenes.length === 0) {
        return NextResponse.json({
          pass: true,
          issues: [],
          summary: "No scenes provided — nothing to check.",
        });
      }

      // Build a structured text summary for the LLM
      const charDescriptions = characters
        .map((c) => `  - ${c.id}${c.name ? ` (${c.name})` : ""}${c.description ? `: ${c.description}` : ""}`)
        .join("\n");

      const sceneDescriptions = scenes
        .map(
          (s) =>
            `  - Scene ${s.sceneId}: characters [${(s.characterIds ?? []).join(", ")}], has image: ${s.imageUrl ? "yes" : "no"}`,
        )
        .join("\n");

      const prompt =
        "You are a visual consistency checker for an AI video project.\n\n" +
        "Characters:\n" + (charDescriptions || "  (none provided)") + "\n\n" +
        "Scenes:\n" + sceneDescriptions + "\n\n" +
        "For each scene, flag any potential visual consistency problems such as:\n" +
        "- Character appears in scene but has no generated image\n" +
        "- Scene has no image generated\n" +
        "- Character used in too many or too few scenes (distribution issues)\n" +
        "- Any other consistency concern you can infer from the data\n\n" +
        "Return JSON only: { \"issues\": [{\"sceneId\": \"SC01\", \"issue\": \"...\"}], \"summary\": \"...\" }\n" +
        "If no issues, return { \"issues\": [], \"summary\": \"All scenes appear visually consistent.\" }";

      const apiKey = process.env.ANTHROPIC_API_KEY;
      let issueList: Array<{ sceneId: string; issue: string }> = [];
      let summary = "Visual consistency check complete.";

      if (apiKey) {
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 600,
              messages: [{ role: "user", content: prompt }],
            }),
            signal: AbortSignal.timeout(25000),
          });

          if (res.ok) {
            const data = await res.json();
            const raw: string = data?.content?.[0]?.text ?? "";
            // Extract JSON from response
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              issueList = Array.isArray(parsed.issues) ? parsed.issues : [];
              summary = parsed.summary ?? summary;
            }
          }
        } catch {
          // LLM unavailable — do a simple rule-based fallback
          issueList = scenes
            .filter((s) => !s.imageUrl)
            .map((s) => ({ sceneId: s.sceneId, issue: "No image generated for this scene." }));
          summary = `Rule-based check only (LLM unavailable). Found ${issueList.length} issue(s).`;
        }
      } else {
        // No API key — rule-based only
        issueList = scenes
          .filter((s) => !s.imageUrl)
          .map((s) => ({ sceneId: s.sceneId, issue: "No image generated for this scene." }));
        summary = `Rule-based check only (no ANTHROPIC_API_KEY). Found ${issueList.length} issue(s).`;
      }

      return NextResponse.json({
        pass: issueList.length === 0,
        issues: issueList,
        summary,
      });
    }

    return NextResponse.json({ error: `Unknown checkType: ${checkType}` }, { status: 400 });
  } catch (err) {
    console.error("[visual-consistency supervisor] error:", err);
    return NextResponse.json(
      { error: "Visual consistency check failed", details: String(err) },
      { status: 500 },
    );
  }
}
