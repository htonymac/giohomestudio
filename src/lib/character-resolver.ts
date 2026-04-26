// Character Token Resolution Engine
// Scans prompts for character ID tokens, resolves them from the DB,
// and builds enriched generation payloads with character metadata.

import { prisma } from "@/lib/prisma";

export interface ResolvedCharacter {
  characterId: string;
  displayName: string;
  visualDescription: string;
  referenceImageUrls: string[];
  voiceId?: string;
  continuityLocks: {
    skinTone?: string;
    hairStyle?: string;
    faceTraits?: string;
    bodyType?: string;
    wardrobeStyle?: string;
    specialTraits?: string;
  };
}

export interface ResolvedPrompt {
  displayPrompt: string;        // what user sees (unchanged)
  enrichedPrompt: string;       // what goes to AI (with character descriptions injected)
  characters: ResolvedCharacter[];
  referenceImages: string[];    // all character reference image URLs
}

// Token pattern: uppercase words with underscores ending in digits, e.g. JON_RABBIT848, FOX_5858
// Matches IDs like: JON_RABBIT848, XX_OLDBIGRABBIT65WARMGREY, NG_CHIKEWARRIOR35DEEPDARK
// Requires at least one digit anywhere in the token (distinguishes from plain uppercase words)
const BARE_TOKEN = /\b[A-Z][A-Z0-9_]*\d+[A-Z0-9]*\b/g;
const BRACKET_TOKEN = /\[([A-Z][A-Z0-9_]*\d+[A-Z0-9]*)\]/g;

/**
 * Extract reference image URLs from the referenceImages JSON field.
 * Handles both array-of-objects [{url, angle, label}] and string[] formats.
 */
function normalizeStorageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("/api/")) return url;
  const cleaned = url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
}

function extractImageUrls(referenceImages: unknown): string[] {
  if (!referenceImages) return [];
  if (!Array.isArray(referenceImages)) return [];
  const urls: string[] = [];
  for (const item of referenceImages) {
    if (typeof item === "string") {
      urls.push(normalizeStorageUrl(item));
    } else if (item && typeof item === "object" && typeof (item as Record<string, unknown>).url === "string") {
      urls.push(normalizeStorageUrl((item as Record<string, unknown>).url as string));
    }
  }
  return urls;
}

/**
 * Build a character description string for prompt injection.
 */
function buildCharacterSnippet(char: {
  name: string;
  visualDescription?: string | null;
  personality?: string | null;
  wardrobe?: string | null;
  hairstyle?: string | null;
  culture?: string | null;
  age?: string | null;
  height?: string | null;
}): string {
  const parts: string[] = [];
  if (char.visualDescription) parts.push(char.visualDescription);
  if (char.age) parts.push(`age: ${char.age}`);
  if (char.height) parts.push(`${char.height} build`);
  if (char.hairstyle) parts.push(`hair: ${char.hairstyle}`);
  if (char.wardrobe) parts.push(`wearing: ${char.wardrobe}`);
  if (char.culture) parts.push(`${char.culture} background`);
  if (char.personality) parts.push(`personality: ${char.personality}`);
  return parts.join(". ");
}

/**
 * Main function: resolve character tokens in a prompt.
 *
 * 1. Scans for tokens matching [A-Z][A-Z0-9_]+\d+ pattern
 * 2. Queries the CharacterVoice table for matching characterId or name
 * 3. Builds enriched prompt with character descriptions injected
 * 4. Collects all reference images for visual consistency
 */
export async function resolveCharacterTokens(prompt: string): Promise<ResolvedPrompt> {
  // Extract potential tokens from the prompt (both bare and bracketed)
  const bareMatches = prompt.match(BARE_TOKEN) || [];
  const bracketMatches: string[] = [];
  let bm: RegExpExecArray | null;
  const bracketRe = /\[([A-Z][A-Z0-9_]*\d+[A-Z0-9]*)\]/g;
  while ((bm = bracketRe.exec(prompt)) !== null) {
    bracketMatches.push(bm[1]); // extract the ID inside brackets
  }
  const uniqueTokens = [...new Set([...bareMatches, ...bracketMatches])];

  // Early return if no tokens found
  if (uniqueTokens.length === 0) {
    return {
      displayPrompt: prompt,
      enrichedPrompt: prompt,
      characters: [],
      referenceImages: [],
    };
  }

  // Strip brackets from any tokens that still have them (defensive)
  const cleanedTokens = uniqueTokens.map(t => t.replace(/^\[|\]$/g, ""));
  const allTokens = [...new Set([...uniqueTokens, ...cleanedTokens])];

  // Single DB query: find characters where characterId, id, or name matches any token
  const characters = await prisma.characterVoice.findMany({
    where: {
      OR: [
        { characterId: { in: allTokens } },
        { id: { in: allTokens } },
        { name: { in: allTokens } },
      ],
    },
  });

  // If no characters found, return unchanged
  if (characters.length === 0) {
    return {
      displayPrompt: prompt,
      enrichedPrompt: prompt,
      characters: [],
      referenceImages: [],
    };
  }

  // Build lookup: token -> character record (match on characterId, id, or name)
  const tokenToChar = new Map<string, typeof characters[0]>();
  for (const char of characters) {
    if (char.characterId && allTokens.includes(char.characterId)) {
      tokenToChar.set(char.characterId, char);
    }
    if (allTokens.includes(char.id)) {
      tokenToChar.set(char.id, char);
    }
    if (allTokens.includes(char.name)) {
      tokenToChar.set(char.name, char);
    }
  }

  // Build enriched prompt by replacing each token with character description
  let enrichedPrompt = prompt;
  const resolvedCharacters: ResolvedCharacter[] = [];
  const allRefImages: string[] = [];
  const processedCharIds = new Set<string>();

  for (const [token, char] of tokenToChar.entries()) {
    // Avoid processing the same character twice (matched on both characterId and name)
    const charKey = char.id;
    if (processedCharIds.has(charKey)) {
      // Still do the replacement for this token alias
      const snippet = buildCharacterSnippet(char);
      const replacement = `[Character: ${char.name} — ${snippet}]`;
      enrichedPrompt = enrichedPrompt.replaceAll(`[${token}]`, replacement);
      enrichedPrompt = enrichedPrompt.replaceAll(token, replacement);
      continue;
    }
    processedCharIds.add(charKey);

    const snippet = buildCharacterSnippet(char);
    const replacement = `[Character: ${char.name} — ${snippet}]`;
    // Replace bracketed form first (e.g. [US_JAMES57BLACK1]) then bare form
    enrichedPrompt = enrichedPrompt.replaceAll(`[${token}]`, replacement);
    enrichedPrompt = enrichedPrompt.replaceAll(token, replacement);

    // Extract reference image URLs
    const refUrls = extractImageUrls(char.referenceImages);
    // Also include the main imageUrl if present
    if (char.imageUrl) {
      refUrls.unshift(normalizeStorageUrl(char.imageUrl));
    }
    allRefImages.push(...refUrls);

    resolvedCharacters.push({
      characterId: char.characterId || char.id,
      displayName: char.name,
      visualDescription: snippet,
      referenceImageUrls: refUrls,
      voiceId: char.voiceId || undefined,
      continuityLocks: {
        skinTone: char.culture || undefined,
        hairStyle: char.hairstyle || undefined,
        faceTraits: char.visualDescription || undefined,
        bodyType: char.height || undefined,
        wardrobeStyle: char.wardrobe || undefined,
        specialTraits: char.personality || undefined,
      },
    });
  }

  return {
    displayPrompt: prompt,
    enrichedPrompt,
    characters: resolvedCharacters,
    referenceImages: allRefImages,
  };
}
