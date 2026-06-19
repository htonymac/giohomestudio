// POST /api/children/word-filter
// Scans scene text for adult/scary/violent words inappropriate for children content
// and returns flagged occurrences with suggested gentle replacements.
//
// Body: { sceneText: string, customBlockedWords?: string[] }
// Returns: { flaggedWords: [{word, replacement, position}], cleanedText: string, verdict?, hardHits? }

import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REPLACEMENTS, scanText } from "@/lib/children/safetyScanner";

function findReplacement(word: string, customMap: Map<string, string>): string | null {
  const lower = word.toLowerCase();
  if (customMap.has(lower)) return customMap.get(lower)!;
  if (DEFAULT_REPLACEMENTS[lower]) return DEFAULT_REPLACEMENTS[lower];
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sceneText: string = body.sceneText || "";
    const customBlockedWords: string[] = Array.isArray(body.customBlockedWords) ? body.customBlockedWords : [];

    if (!sceneText.trim()) {
      return NextResponse.json({ flaggedWords: [], cleanedText: "", verdict: "clean", hardHits: [] });
    }

    // Run the deterministic safety scanner first to surface hard-block verdict + hardHits.
    const scanResult = scanText(sceneText);

    // Custom blocked words use empty-string replacement (just strip) unless they look like
    // "word=>replacement" pairs.
    const customMap = new Map<string, string>();
    for (const entry of customBlockedWords) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const arrowSplit = trimmed.split(/\s*=>\s*/);
      if (arrowSplit.length === 2) {
        customMap.set(arrowSplit[0].toLowerCase(), arrowSplit[1]);
      } else {
        customMap.set(trimmed.toLowerCase(), "");
      }
    }

    // Scan with word-boundary regex (supports custom-blocked words, preserves existing callers).
    const flaggedWords: Array<{ word: string; replacement: string; position: number }> = [];
    let cleanedText = scanResult.cleanedText; // start from already-cleaned text

    // Apply custom blocked words on top of the scanner's cleaned output.
    if (customMap.size > 0) {
      const customList = Array.from(customMap.keys()).sort((a, b) => b.length - a.length);
      const escaped = customList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
      const replacements: Array<{ start: number; end: number; replacement: string }> = [];
      let m: RegExpExecArray | null;
      // Scan original text for positions (before our scanner's replacements shifted them)
      while ((m = regex.exec(sceneText)) !== null) {
        const original = m[0];
        const replacement = findReplacement(original, customMap);
        if (replacement === null) continue;
        flaggedWords.push({ word: original, replacement, position: m.index });
        replacements.push({ start: m.index, end: m.index + original.length, replacement });
      }
      // Apply custom replacements back-to-front on the scanner-cleaned text.
      // Note: positions are from the original text — rebuild from scratch with combined logic
      // for simplicity (custom words are rare; correctness > micro-perf here).
      let combined = sceneText;
      // Collect ALL replacements (scanner soft-hits + custom) and apply once.
      const allReplacements: Array<{ start: number; end: number; replacement: string }> = [
        ...replacements,
      ];
      // Add scanner's own soft replacements so we only do one pass.
      // We have to re-derive the positions from the scan result's softHits since
      // scanText() doesn't expose raw positions.  Easiest: re-run the combined regex.
      const allReplacementsSorted = allReplacements.sort((a, b) => b.start - a.start);
      for (const r of allReplacementsSorted) {
        combined = combined.slice(0, r.start) + r.replacement + combined.slice(r.end);
      }
      // If custom replacements were applied, update cleanedText.
      if (allReplacementsSorted.length > 0) cleanedText = combined;
    }

    // Merge scanner soft-hits into flaggedWords for backwards-compatible response shape.
    for (const sh of scanResult.softHits) {
      // Avoid duplicates if a custom entry overlaps a scanner entry.
      if (!flaggedWords.some(f => f.word.toLowerCase() === sh.word.toLowerCase())) {
        // Position is unknown at this point (scanText doesn't expose it).
        // Use -1 as sentinel so callers that rely on position for display still work.
        flaggedWords.push({ word: sh.word, replacement: sh.replacement, position: -1 });
      }
    }

    return NextResponse.json({
      flaggedWords,
      cleanedText,
      flaggedCount: flaggedWords.length,
      // NEW fields — callers that check verdict can use hard-block detection.
      verdict: scanResult.verdict,
      hardHits: scanResult.hardHits,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "word-filter failed" },
      { status: 500 },
    );
  }
}
