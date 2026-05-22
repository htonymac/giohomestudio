// POST /api/children/word-filter
// Scans scene text for adult/scary/violent words inappropriate for children content
// and returns flagged occurrences with suggested gentle replacements.
//
// Body: { sceneText: string, customBlockedWords?: string[] }
// Returns: { flaggedWords: [{word, replacement, position}], cleanedText: string }

import { NextRequest, NextResponse } from "next/server";

// Default block list: word → gentle replacement
// Categories: violence, weapons, scary, adult, body harm
const DEFAULT_REPLACEMENTS: Record<string, string> = {
  // Violence
  "kill":         "stop",
  "kills":        "stops",
  "killed":       "stopped",
  "killing":      "stopping",
  "murder":       "tag",
  "murdered":     "tagged",
  "stab":         "tap",
  "stabbed":      "tapped",
  "stabbing":     "tapping",
  "shoot":        "zap",
  "shoots":       "zaps",
  "shot":         "zapped",
  "shooting":     "zapping",
  "punch":        "bump",
  "punched":      "bumped",
  "punching":     "bumping",
  "fight":        "play-tussle",
  "fights":       "play-tussles",
  "fighting":     "play-tussling",
  "attack":       "surprise",
  "attacks":      "surprises",
  "attacked":     "surprised",
  "attacking":    "surprising",
  "hurt":         "bump",
  "hurts":        "bumps",
  "hurting":      "bumping",
  // Weapons
  "gun":          "toy",
  "guns":         "toys",
  "knife":        "stick",
  "knives":       "sticks",
  "sword":        "wand",
  "swords":       "wands",
  "bomb":         "balloon",
  "bombs":        "balloons",
  "weapon":       "tool",
  "weapons":      "tools",
  // Scary
  "scary":        "silly",
  "terrifying":   "surprising",
  "horror":       "surprise",
  "horrible":     "tricky",
  "nightmare":    "funny dream",
  "monster":      "creature",
  "monsters":     "creatures",
  "evil":         "grumpy",
  "demon":        "imp",
  "demons":       "imps",
  "ghost":        "spirit-friend",
  "ghosts":       "spirit-friends",
  "blood":        "paint",
  "bloody":       "painted",
  // Body harm
  "die":          "rest",
  "dies":         "rests",
  "died":         "rested",
  "dying":        "resting",
  "death":        "the long sleep",
  "dead":         "asleep",
  "wound":        "scratch",
  "wounded":      "scratched",
  // Adult/inappropriate
  "drunk":        "dizzy",
  "drug":         "snack",
  "drugs":        "snacks",
  "sex":          "love",
  "kiss":         "hug",
  "kissed":       "hugged",
  "kissing":      "hugging",
  "naked":        "in pajamas",
  "nude":         "in pajamas",
  "stupid":       "silly",
  "idiot":        "goofball",
  "dumb":         "silly",
  "hate":         "dislike",
  "hates":        "dislikes",
  "hated":        "disliked",
  "hating":       "disliking",
};

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
      return NextResponse.json({ flaggedWords: [], cleanedText: "" });
    }

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

    // Scan with word-boundary regex
    const flaggedWords: Array<{ word: string; replacement: string; position: number }> = [];
    let cleanedText = sceneText;

    // Build a regex of all blocked words (custom + default)
    const allBlocked = new Set<string>([
      ...Object.keys(DEFAULT_REPLACEMENTS),
      ...customMap.keys(),
    ]);

    if (allBlocked.size === 0) {
      return NextResponse.json({ flaggedWords: [], cleanedText });
    }

    // Sort by length descending so multi-word phrases match before single words
    const blockedList = Array.from(allBlocked).sort((a, b) => b.length - a.length);
    // Escape regex special chars
    const escaped = blockedList.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    let m: RegExpExecArray | null;
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];
    while ((m = regex.exec(sceneText)) !== null) {
      const original = m[0];
      const replacement = findReplacement(original, customMap);
      if (replacement === null) continue;
      flaggedWords.push({ word: original, replacement, position: m.index });
      replacements.push({ start: m.index, end: m.index + original.length, replacement });
    }

    // Apply replacements back-to-front so positions don't shift
    replacements.sort((a, b) => b.start - a.start).forEach(r => {
      cleanedText = cleanedText.slice(0, r.start) + r.replacement + cleanedText.slice(r.end);
    });

    return NextResponse.json({
      flaggedWords,
      cleanedText,
      flaggedCount: flaggedWords.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "word-filter failed" },
      { status: 500 },
    );
  }
}
