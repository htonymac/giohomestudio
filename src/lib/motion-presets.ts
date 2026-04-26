// GHS Motion Preset Library — 20 CapCut-style reusable motion presets
//
// Each preset defines how a scene enters, moves, and exits.
// Used by: Video Blueprint (Stage 1), Collaborative Editor, Assembly Builder
// Presets are applied via FFmpeg filters (zoompan, setpts, drawtext enable)

export interface MotionPreset {
  id: string;
  name: string;
  category: "transition" | "camera" | "speed" | "effect" | "product" | "text";
  description: string;

  // Timing
  start_time_ms?: number;    // relative to scene start
  end_time_ms?: number;      // relative to scene start

  // Motion parameters
  easing: "linear" | "ease_in" | "ease_out" | "ease_in_out" | "spring" | "bounce";
  intensity: number;         // 0.0-1.0
  direction?: "left" | "right" | "up" | "down" | "in" | "out";

  // Scale
  scale_from?: number;       // 1.0 = 100%
  scale_to?: number;

  // Opacity
  opacity_from?: number;     // 0-1
  opacity_to?: number;

  // Position offset (px)
  offset_x?: number;
  offset_y?: number;

  // Extras
  motion_blur_on?: boolean;
  sound_sync_marker?: boolean; // sync to beat
  speed_multiplier?: number;   // for speed effects

  // FFmpeg filter expression (generated from params)
  ffmpegFilter?: string;
}

export const MOTION_PRESETS: MotionPreset[] = [
  // ── TRANSITIONS ──
  {
    id: "fade_in",
    name: "Fade In",
    category: "transition",
    description: "Smooth fade from black to full visibility",
    easing: "ease_in_out",
    intensity: 1.0,
    opacity_from: 0,
    opacity_to: 1,
    ffmpegFilter: "fade=t=in:st=0:d=0.8",
  },
  {
    id: "fade_out",
    name: "Fade Out",
    category: "transition",
    description: "Smooth fade from full visibility to black",
    easing: "ease_in_out",
    intensity: 1.0,
    opacity_from: 1,
    opacity_to: 0,
    ffmpegFilter: "fade=t=out:st={duration-0.8}:d=0.8",
  },
  {
    id: "slide_in_left",
    name: "Slide In Left",
    category: "transition",
    description: "Content slides in from the left edge",
    easing: "ease_out",
    intensity: 0.8,
    direction: "left",
    offset_x: -1920,
    ffmpegFilter: "overlay=x='if(lt(t,0.5),-W+(t/0.5)*W,0)':y=0",
  },
  {
    id: "slide_in_right",
    name: "Slide In Right",
    category: "transition",
    description: "Content slides in from the right edge",
    easing: "ease_out",
    intensity: 0.8,
    direction: "right",
    offset_x: 1920,
    ffmpegFilter: "overlay=x='if(lt(t,0.5),W-(t/0.5)*W,0)':y=0",
  },
  {
    id: "push_up_in",
    name: "Push Up In",
    category: "transition",
    description: "Content pushes up from the bottom",
    easing: "ease_out",
    intensity: 0.7,
    direction: "up",
    offset_y: 1080,
    ffmpegFilter: "overlay=x=0:y='if(lt(t,0.5),H-(t/0.5)*H,0)'",
  },
  {
    id: "push_down_out",
    name: "Push Down Out",
    category: "transition",
    description: "Content pushes down and exits",
    easing: "ease_in",
    intensity: 0.7,
    direction: "down",
    offset_y: -1080,
    ffmpegFilter: "overlay=x=0:y='if(gt(t,{duration-0.5}),(t-({duration-0.5}))/0.5*H,0)'",
  },

  // ── CAMERA ──
  {
    id: "zoom_in_soft",
    name: "Zoom In Soft",
    category: "camera",
    description: "Gentle zoom into the subject — Ken Burns style",
    easing: "ease_in_out",
    intensity: 0.3,
    scale_from: 1.0,
    scale_to: 1.15,
    ffmpegFilter: "zoompan=z='min(1.15,1+0.0003*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fps*duration}:s=1920x1080",
  },
  {
    id: "zoom_out_soft",
    name: "Zoom Out Soft",
    category: "camera",
    description: "Gentle zoom out from the subject",
    easing: "ease_in_out",
    intensity: 0.3,
    scale_from: 1.15,
    scale_to: 1.0,
    ffmpegFilter: "zoompan=z='max(1.0,1.15-0.0003*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fps*duration}:s=1920x1080",
  },
  {
    id: "whip_pan_sim",
    name: "Whip Pan",
    category: "camera",
    description: "Fast simulated horizontal pan — energy and urgency",
    easing: "linear",
    intensity: 1.0,
    direction: "right",
    motion_blur_on: true,
    ffmpegFilter: "crop=w=iw*0.8:h=ih:x='iw*0.1+iw*0.1*sin(t*3)':y=0,scale=1920:1080",
  },
  {
    id: "reveal_hold_exit",
    name: "Reveal Hold Exit",
    category: "camera",
    description: "Fade in → hold steady → fade out. Clean standard motion.",
    easing: "ease_in_out",
    intensity: 0.5,
    opacity_from: 0,
    opacity_to: 1,
    ffmpegFilter: "fade=t=in:st=0:d=0.5,fade=t=out:st={duration-0.5}:d=0.5",
  },

  // ── SPEED ──
  {
    id: "fast_forward_ramp",
    name: "Fast Forward Ramp",
    category: "speed",
    description: "Accelerates then returns to normal — dramatic time skip",
    easing: "ease_in_out",
    intensity: 0.8,
    speed_multiplier: 2.0,
    ffmpegFilter: "setpts='if(lt(T,{duration*0.3}),PTS,if(lt(T,{duration*0.7}),PTS*0.5,PTS))'",
  },
  {
    id: "slow_motion_emphasis",
    name: "Slow Motion",
    category: "speed",
    description: "Dramatic slowdown for emphasis — hero moment",
    easing: "ease_in_out",
    intensity: 0.7,
    speed_multiplier: 0.5,
    ffmpegFilter: "setpts=2.0*PTS",
  },
  {
    id: "beat_cut",
    name: "Beat Cut",
    category: "speed",
    description: "Quick cuts synced to music beats — energetic montage feel",
    easing: "linear",
    intensity: 1.0,
    sound_sync_marker: true,
    ffmpegFilter: "trim=duration=0.5",
  },

  // ── EFFECT ──
  {
    id: "screen_punch_zoom",
    name: "Punch Zoom",
    category: "effect",
    description: "Quick zoom punch for impact — reaction or emphasis",
    easing: "spring",
    intensity: 0.9,
    scale_from: 1.0,
    scale_to: 1.3,
    ffmpegFilter: "zoompan=z='if(lt(on,5),1+on*0.06,1.3-((on-5)*0.02))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=15:s=1920x1080",
  },
  {
    id: "parallax_float",
    name: "Parallax Float",
    category: "effect",
    description: "Gentle floating parallax — dreamy and premium feel",
    easing: "ease_in_out",
    intensity: 0.4,
    scale_from: 1.05,
    scale_to: 1.05,
    offset_x: 30,
    ffmpegFilter: "zoompan=z=1.05:x='iw/2-(iw/zoom/2)+30*sin(on*0.02)':y='ih/2-(ih/zoom/2)+15*cos(on*0.02)':d={fps*duration}:s=1920x1080",
  },
  {
    id: "blur_to_focus",
    name: "Blur to Focus",
    category: "effect",
    description: "Starts blurry, reveals sharp — cinematic rack focus",
    easing: "ease_out",
    intensity: 0.8,
    ffmpegFilter: "boxblur=luma_radius='max(0,20-20*t/{duration})':luma_power=1",
  },
  {
    id: "before_after_split",
    name: "Before / After Split",
    category: "effect",
    description: "Wipe reveal showing before vs after — transformation content",
    easing: "linear",
    intensity: 1.0,
    direction: "right",
    ffmpegFilter: "crop=w='iw*t/{duration}':h=ih:x=0:y=0",
  },

  // ── PRODUCT ──
  {
    id: "product_orbit_sim",
    name: "Product Orbit",
    category: "product",
    description: "Simulated slow orbit around product — commercial showcase",
    easing: "ease_in_out",
    intensity: 0.5,
    scale_from: 1.0,
    scale_to: 1.1,
    ffmpegFilter: "zoompan=z='1+0.05*sin(on*0.03)':x='iw/2-(iw/zoom/2)+50*sin(on*0.02)':y='ih/2-(ih/zoom/2)':d={fps*duration}:s=1920x1080",
  },
  {
    id: "detail_macro_reveal",
    name: "Macro Reveal",
    category: "product",
    description: "Zoom into product detail — texture, ingredient, label closeup",
    easing: "ease_in",
    intensity: 0.7,
    scale_from: 1.0,
    scale_to: 1.6,
    ffmpegFilter: "zoompan=z='min(1.6,1+0.001*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fps*duration}:s=1920x1080",
  },

  // ── TEXT ──
  {
    id: "caption_pop_in",
    name: "Caption Pop In",
    category: "text",
    description: "Text pops in with bounce — social media caption style",
    easing: "spring",
    intensity: 0.8,
    scale_from: 0,
    scale_to: 1.0,
    opacity_from: 0,
    opacity_to: 1,
    ffmpegFilter: "drawtext=fontsize=48:fontcolor=white:text='{text}':x=(w-text_w)/2:y=h-80:enable='gte(t,{start})'",
  },
];

// Get preset by ID
export function getMotionPreset(id: string): MotionPreset | undefined {
  return MOTION_PRESETS.find(p => p.id === id);
}

// Get presets by category
export function getPresetsByCategory(category: MotionPreset["category"]): MotionPreset[] {
  return MOTION_PRESETS.filter(p => p.category === category);
}

// Generate FFmpeg filter string from preset with actual values
export function resolvePresetFilter(preset: MotionPreset, params: {
  duration: number;
  fps?: number;
  text?: string;
  start?: number;
}): string {
  if (!preset.ffmpegFilter) return "";
  let filter = preset.ffmpegFilter;
  filter = filter.replace(/\{duration\}/g, String(params.duration));
  filter = filter.replace(/\{duration\*([0-9.]+)\}/g, (_, mult) => String(params.duration * parseFloat(mult)));
  filter = filter.replace(/\{duration-([0-9.]+)\}/g, (_, sub) => String(params.duration - parseFloat(sub)));
  filter = filter.replace(/\{fps\*duration\}/g, String((params.fps || 30) * params.duration));
  filter = filter.replace(/\{fps\}/g, String(params.fps || 30));
  filter = filter.replace(/\{text\}/g, params.text || "");
  filter = filter.replace(/\{start\}/g, String(params.start || 0));
  return filter;
}
