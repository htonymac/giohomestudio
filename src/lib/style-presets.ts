// GHS Visual Style Presets — shared across scene-image, scene-video, character-build
// Source of truth for all style directives. Import this everywhere, never duplicate.

export interface StylePreset {
  prefix: string;   // injected FIRST in prompt — commits the model to render style
  suffix: string;   // quality reinforcement at end
  negative: string; // negative prompt — blocks style drift
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  "3d-cinematic": {
    prefix: "3D animated film, Pixar/DreamWorks quality, volumetric lighting, smooth skin textures, fabric and clothing textures, subsurface scattering, cinematic depth of field, rich color grading, 3D render, CGI animation",
    suffix: "Highly detailed 3D render, professional VFX, cinematic lighting, consistent character design",
    // bear-guard: removed "photorealistic fur textures" — it primed image models toward animal/bear anatomy
    negative: "2D flat illustration, cartoon drawing, anime, sketch, watercolor, flat colors, clipart, sticker, cel-shaded, painted, bear, animal face, fur body, snout, paws",
  },
  "2d-cartoon": {
    prefix: "2D cartoon illustration, clean bold outlines, flat cel-shaded colors, Disney storybook art style, vibrant colors",
    suffix: "Clean illustration, consistent character design, professional cartoon art",
    negative: "3D render, photorealistic, CGI, bokeh, subsurface scattering, depth of field blur",
  },
  "anime": {
    prefix: "Anime style, Japanese animation, detailed anime art, studio-quality anime illustration, clean linework",
    suffix: "Consistent anime character design, professional anime production art",
    negative: "3D render, photorealistic, CGI, Western cartoon, flat illustration",
  },
  "storybook": {
    prefix: "Children's storybook illustration, warm painterly style, soft watercolor textures, whimsical and charming, storybook art",
    suffix: "Consistent storybook illustration style, warm colors, professional children's book art",
    negative: "3D render, photorealistic, dark, scary, anime",
  },
  "realistic": {
    // STRONG photo terms FIRST + explicit "live-action photo" cue so model commits to real photography,
    // not 3D render. Without this anchor, models trained on Pixar/DreamWorks data drift back to 3D.
    prefix: "Live-action cinematic photography, real photograph, photorealistic, professional cinema camera, real human skin texture, real fabric, natural lighting, hyper-detailed, 8K photo",
    suffix: "Real photograph, professional cinematography, natural skin pores, fine fabric weave, true-to-life proportions",
    // 3D/CGI/animation terms MUST be in the negative — otherwise the model treats "realistic" as
    // "realistic 3D render" and produces Pixar-style. Includes Pixar/DreamWorks/animated film cues.
    negative: "3D render, CGI, animated film, Pixar style, DreamWorks style, animation, cartoon, 2D illustration, anime, flat colors, sketch, painterly, watercolor, stylized, video game graphics, plastic skin, doll-like",
  },
  "nollywood": {
    prefix: "Nollywood film aesthetic, warm African lighting, rich skin tones, vibrant traditional and contemporary Nigerian fashion, cinematic drama",
    suffix: "Cinematic Nigerian film quality, authentic cultural detail, professional production",
    negative: "anime, cartoon, western CGI, flat illustration",
  },
  "comic": {
    prefix: "Comic book art style, bold ink outlines, halftone shading, dynamic panel composition, superhero comic aesthetic",
    suffix: "Consistent comic book art, dynamic poses, professional comic illustration",
    negative: "3D render, photorealistic, soft watercolor, anime",
  },
};

export function getStylePreset(style: string | null | undefined): StylePreset {
  return STYLE_PRESETS[style ?? "3d-cinematic"] ?? STYLE_PRESETS["3d-cinematic"];
}

// Motion style prefix for video generation — same style lock but phrased for motion prompts
export function getMotionStylePrefix(style: string | null | undefined): string {
  const preset = getStylePreset(style);
  // Condense to key terms for video prompt (shorter = more effective for video models)
  const shortMap: Record<string, string> = {
    "3d-cinematic": "3D CGI animated film, Pixar-quality, cinematic motion",
    "2d-cartoon": "2D cartoon animation, flat cel-shaded style",
    "anime": "anime animation style, Japanese animation quality",
    "storybook": "storybook illustration animation, warm painterly style",
    "realistic": "photorealistic cinematic footage, live-action quality",
    "nollywood": "Nollywood cinematic film, warm African aesthetic",
    "comic": "comic book animation, bold ink outlines, dynamic action",
  };
  return shortMap[style ?? "3d-cinematic"] ?? shortMap["3d-cinematic"];
}
