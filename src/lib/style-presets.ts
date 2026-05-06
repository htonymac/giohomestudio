// GHS Visual Style Presets — shared across scene-image, scene-video, character-build
// Source of truth for all style directives. Import this everywhere, never duplicate.

export interface StylePreset {
  prefix: string;   // injected FIRST in prompt — commits the model to render style
  suffix: string;   // quality reinforcement at end
  negative: string; // negative prompt — blocks style drift
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
  "3d-cinematic": {
    prefix: "3D animated film, Pixar/DreamWorks quality, volumetric lighting, photorealistic fur textures, subsurface scattering, cinematic depth of field, rich color grading, 3D render, CGI animation",
    suffix: "Highly detailed 3D render, professional VFX, cinematic lighting, consistent character design",
    negative: "2D flat illustration, cartoon drawing, anime, sketch, watercolor, flat colors, clipart, sticker, cel-shaded, painted",
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
    prefix: "Photorealistic, hyper-detailed, cinematic photography, professional lighting, 8K render",
    suffix: "Photorealistic quality, consistent character appearance, cinematic composition",
    negative: "cartoon, anime, 2D illustration, flat colors, sketch, painterly",
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
