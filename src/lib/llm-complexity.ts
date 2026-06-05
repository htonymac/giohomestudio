// LLM cost router — H6 of 12-hour run (2026-06-05).
//
// Per the production doctrine (MUST_READ_BEFORE_APP §21):
// "Not every request needs GPT-5. Build a classifier, 10 lines of code,
//  check token count, detect question complexity, route accordingly. Your
//  average cost per request drops 70%."
//
// Strategy: cheap regex-based classifier. If a prompt is short, asks a yes/no,
// requests formatting, or is a FAQ-shape, route to "fast" (Haiku / GPT-4o-mini).
// Otherwise route to caller's specified speed.
//
// Plumbed via LLMOptions.autoSpeed = true (opt-in). Existing callers untouched.

export type ComplexityVerdict = "simple" | "complex";

export interface ComplexityScore {
  verdict: ComplexityVerdict;
  reason: string;
  promptTokensEst: number;
}

const SIMPLE_TRIGGERS = [
  /^\s*(yes|no|true|false|count|how many|list|summarize|format|convert|translate|explain in one line|tldr)/i,
  /^\s*\d+\s*[+\-*/]\s*\d+/,                            // basic math
  /^\s*(what is|who is|when did|where is)\b.{0,80}\?\s*$/i, // short factoid
  /^\s*(json|markdown|csv|yaml)\s*:/i,                  // format coercion
  /^\s*say\s+(hi|hello|thanks|bye)\b/i,
];

const COMPLEX_TRIGGERS = [
  /\bstep[ -]by[ -]step\b/i,
  /\banalyze\b|\banalyse\b/i,
  /\bgenerate (a |the )?(full |complete |detailed )?(story|script|scene|character)/i,
  /\bplan\b.{0,40}\bscene/i,
  /\bcreate\b.{0,40}\b(narrative|plot|character|world|outline)/i,
  /\b(code|implement|refactor|debug)\b/i,
  /\b(reasoning|chain.of.thought|cot)\b/i,
];

// Cheap token estimator — chars/4 is close enough for English. Used only for routing.
function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export function scoreComplexity(prompt: string, system?: string): ComplexityScore {
  const promptTokensEst = estimateTokens(prompt) + estimateTokens(system ?? "");

  // Length-based shortcuts
  if (promptTokensEst < 60) {
    return { verdict: "simple", reason: `short_prompt_${promptTokensEst}tok`, promptTokensEst };
  }
  if (promptTokensEst > 800) {
    return { verdict: "complex", reason: `long_prompt_${promptTokensEst}tok`, promptTokensEst };
  }

  for (const r of SIMPLE_TRIGGERS) {
    if (r.test(prompt)) return { verdict: "simple", reason: `simple_trigger:${r.source.slice(0, 40)}`, promptTokensEst };
  }
  for (const r of COMPLEX_TRIGGERS) {
    if (r.test(prompt)) return { verdict: "complex", reason: `complex_trigger:${r.source.slice(0, 40)}`, promptTokensEst };
  }

  // Default to complex for medium-length unrecognized prompts (safer — better
  // to over-pay than to ship a wrong-tier dumb response).
  return { verdict: "complex", reason: "unknown_default_complex", promptTokensEst };
}
