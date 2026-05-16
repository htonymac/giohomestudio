// src/types/character.ts
// Shared CharacterIdentity type — used across CharacterPicker, character-voices page,
// and other surfaces that work with character reference images.
//
// DO NOT import from hybrid-planner — that file is locked.
// This is the canonical shared type for all character-related surfaces.

export interface ReferenceImage {
  url: string;
  angle?: string;   // e.g. "front", "side", "back", "three-quarter"
  label?: string;   // e.g. "casual outfit", "formal wear"
}

export interface CharacterIdentity {
  id: string;                       // DB record ID
  characterId: string;              // e.g. "NG_AMAKA_25F_BOLD"
  name: string;
  gender?: string;
  age?: string;
  culture?: string;
  visualDescription?: string;
  voiceId?: string;
  voiceProvider?: string;
  imageUrl?: string;                // primary reference image
  referenceImages?: ReferenceImage[]; // up to 4 multi-angle images
  wardrobe?: string;
  hairstyle?: string;
  role?: string;                    // "narrator" | "character" | "extra"
}
