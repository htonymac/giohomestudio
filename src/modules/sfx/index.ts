// GioHomeStudio — SFX Module
//
// Maps sound event names to local MP3 files in storage/sfx/.
// Files are optional — the module returns null for missing files
// so the pipeline skips SFX gracefully rather than failing.
//
// To add SFX: drop MP3 files into storage/sfx/ using the exact
// filenames listed in SFX_LIBRARY below.

import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export interface SFXFile {
  event: string;
  filename: string;
  description: string;
  category: "weather" | "crowd" | "action" | "nature" | "urban" | "horror" | "animal" | "vehicle" | "transition" | "music" | "voice" | "nigerian" | "household" | "tech" | "weapon" | "impact" | "movement" | "children";
}

// Master SFX library — event name → file info
// Drop matching MP3 files in storage/sfx/ to activate each effect.
export const SFX_LIBRARY: SFXFile[] = [
  // Weather
  { event: "thunder",       filename: "thunder.mp3",        description: "Thunderclap rumble",               category: "weather" },
  { event: "rain_light",    filename: "rain_light.mp3",     description: "Light rain / drizzle",             category: "weather" },
  { event: "rain_heavy",    filename: "rain_heavy.mp3",     description: "Heavy downpour",                   category: "weather" },
  { event: "wind",          filename: "wind.mp3",           description: "Howling wind",                     category: "weather" },
  { event: "storm",         filename: "storm.mp3",          description: "Full storm ambience",              category: "weather" },
  // Crowd
  { event: "crowd_cheer",   filename: "crowd_cheer.mp3",    description: "Crowd cheering",                   category: "crowd"   },
  { event: "crowd_murmur",  filename: "crowd_murmur.mp3",   description: "Crowd murmuring / background",     category: "crowd"   },
  { event: "crowd_panic",   filename: "crowd_panic.mp3",    description: "Crowd in panic / screaming",       category: "crowd"   },
  // Action
  { event: "gunshot",       filename: "gunshot.mp3",        description: "Single gunshot",                   category: "action"  },
  { event: "explosion",     filename: "explosion.mp3",      description: "Large explosion",                  category: "action"  },
  { event: "sword_clash",   filename: "sword_clash.mp3",    description: "Sword / metal clash",              category: "action"  },
  { event: "footsteps",     filename: "footsteps.mp3",      description: "Walking footsteps",                category: "action"  },
  { event: "footsteps_run", filename: "footsteps_run.mp3",  description: "Running footsteps",                category: "action"  },
  { event: "fire_crackling",filename: "fire_crackling.mp3", description: "Crackling fire",                   category: "action"  },
  { event: "door_creak",    filename: "door_creak.mp3",     description: "Creaking door",                    category: "action"  },
  { event: "horse_gallop",  filename: "horse_gallop.mp3",   description: "Horse galloping",                  category: "action"  },
  // Nature
  { event: "ocean_waves",   filename: "ocean_waves.mp3",    description: "Ocean waves on shore",             category: "nature"  },
  { event: "forest_ambience",filename:"forest_ambience.mp3",description: "Forest birds / nature ambience",   category: "nature"  },
  { event: "river_stream",  filename: "river_stream.mp3",   description: "Flowing river / stream",           category: "nature"  },
  // Urban
  { event: "city_traffic",  filename: "city_traffic.mp3",   description: "Urban traffic / city ambience",   category: "urban"   },
  { event: "church_bell",   filename: "church_bell.mp3",    description: "Church bell / clock tower chime", category: "urban"   },
  { event: "market_noise",  filename: "market_noise.mp3",   description: "Busy market / marketplace noise", category: "urban"   },
  // Horror / suspense
  { event: "horror_sting",  filename: "horror_sting.mp3",   description: "Horror suspense sting",           category: "horror"  },
  { event: "heartbeat",     filename: "heartbeat.mp3",      description: "Tense heartbeat",                 category: "horror"  },
  // Animal
  { event: "dog_bark",      filename: "dog_bark.mp3",       description: "Dog barking",                     category: "animal"  },
  // Vehicle
  { event: "engine_hum",    filename: "engine_hum.mp3",     description: "Car/vehicle engine idle hum",     category: "vehicle" },
  { event: "road_noise",    filename: "road_noise.mp3",     description: "Road noise / tyre on tarmac",     category: "vehicle" },
  { event: "cabin_ambience",filename: "cabin_ambience.mp3", description: "Interior car cabin ambience",     category: "vehicle" },

  // ── Transitions & Risers ──
  { event: "whoosh",          filename: "whoosh.mp3",           description: "Fast swoosh transition",          category: "transition" },
  { event: "whoosh_deep",     filename: "whoosh_deep.mp3",      description: "Deep bass swoosh",                category: "transition" },
  { event: "riser",           filename: "riser.mp3",            description: "Tension build riser",             category: "transition" },
  { event: "riser_reverse",   filename: "riser_reverse.mp3",    description: "Reverse cymbal riser",            category: "transition" },
  { event: "hit_impact",      filename: "hit_impact.mp3",       description: "Bass hit / impact thud",          category: "transition" },
  { event: "hit_cinematic",   filename: "hit_cinematic.mp3",    description: "Cinematic boom impact",           category: "transition" },
  { event: "tape_stop",       filename: "tape_stop.mp3",        description: "Tape stop / slowdown effect",     category: "transition" },
  { event: "glitch",          filename: "glitch.mp3",           description: "Digital glitch transition",       category: "transition" },

  // ── Weapons ──
  { event: "gunshot_single",  filename: "gunshot_single.mp3",   description: "Single gunshot",                  category: "weapon" },
  { event: "gunshot_burst",   filename: "gunshot_burst.mp3",    description: "Automatic burst fire",            category: "weapon" },
  { event: "gunshot_shotgun", filename: "gunshot_shotgun.mp3",  description: "Shotgun blast",                   category: "weapon" },
  { event: "gunshot_sniper",  filename: "gunshot_sniper.mp3",   description: "Sniper rifle shot",               category: "weapon" },
  { event: "reload",          filename: "reload.mp3",           description: "Gun reload click",                category: "weapon" },
  { event: "sword_slash",     filename: "sword_slash.mp3",      description: "Sword swing slash",               category: "weapon" },
  { event: "sword_clash_metal",filename: "sword_clash.mp3",      description: "Swords clashing / metal on metal",category: "weapon" },
  { event: "arrow_fire",      filename: "arrow_fire.mp3",       description: "Bow and arrow release",           category: "weapon" },

  // ── Impact / Body ──
  { event: "punch",           filename: "punch.mp3",            description: "Fist punch impact",               category: "impact" },
  { event: "kick",            filename: "kick.mp3",             description: "Body kick impact",                category: "impact" },
  { event: "body_fall",       filename: "body_fall.mp3",        description: "Body hitting the ground",         category: "impact" },
  { event: "glass_break",     filename: "glass_break.mp3",      description: "Glass shattering",                category: "impact" },
  { event: "explosion_blast",  filename: "explosion.mp3",        description: "Explosion blast",                 category: "impact" },
  { event: "explosion_distant",filename: "explosion_distant.mp3",description: "Distant explosion rumble",      category: "impact" },

  // ── Nigerian Specific ──
  { event: "danfo_horn",      filename: "danfo_horn.mp3",       description: "Lagos danfo bus horn",            category: "nigerian" },
  { event: "agbero_shout",    filename: "agbero_shout.mp3",     description: "Agbero (tout) shouting",          category: "nigerian" },
  { event: "talking_drum",    filename: "talking_drum.mp3",     description: "Traditional talking drum beat",   category: "nigerian" },
  { event: "shekere",         filename: "shekere.mp3",          description: "Shekere shaker rhythm",           category: "nigerian" },
  { event: "naija_party",     filename: "naija_party.mp3",      description: "Nigerian party ambience",         category: "nigerian" },
  { event: "aso_ebi_crowd",   filename: "aso_ebi_crowd.mp3",    description: "Aso-ebi event celebration crowd", category: "nigerian" },
  { event: "owambe",          filename: "owambe.mp3",           description: "Owambe party celebration",        category: "nigerian" },

  // ── Household ──
  { event: "door_knock",      filename: "door_knock.mp3",       description: "Door knock (3 knocks)",           category: "household" },
  { event: "door_open",       filename: "door_open.mp3",        description: "Door opening creak",              category: "household" },
  { event: "door_close",      filename: "door_close.mp3",       description: "Door closing shut",               category: "household" },
  { event: "bell_ring",       filename: "bell_ring.mp3",        description: "Doorbell ring",                   category: "household" },
  { event: "phone_ring",      filename: "phone_ring.mp3",       description: "Phone ringing",                   category: "household" },
  { event: "notification",    filename: "notification.mp3",     description: "Phone notification sound",        category: "household" },
  { event: "water_pour",      filename: "water_pour.mp3",       description: "Water pouring into glass",        category: "household" },
  { event: "cooking",         filename: "cooking.mp3",          description: "Kitchen cooking / sizzle",        category: "household" },

  // ── Tech / Digital ──
  { event: "typing",          filename: "typing.mp3",           description: "Keyboard typing clicks",          category: "tech" },
  { event: "camera_shutter",  filename: "camera_shutter.mp3",   description: "Camera shutter click",            category: "tech" },
  { event: "ui_click",        filename: "ui_click.mp3",         description: "UI button click",                 category: "tech" },
  { event: "error_beep",      filename: "error_beep.mp3",       description: "Error / wrong answer beep",       category: "tech" },
  { event: "success_chime",   filename: "success_chime.mp3",    description: "Success / correct chime",         category: "tech" },
  { event: "countdown_tick",  filename: "countdown_tick.mp3",   description: "Clock tick countdown",            category: "tech" },

  // ── Music accents ──
  { event: "beat_drop",       filename: "beat_drop.mp3",        description: "Beat drop bass hit",              category: "music" },
  { event: "vinyl_scratch",   filename: "vinyl_scratch.mp3",    description: "DJ vinyl scratch",                category: "music" },
  { event: "airhorn",         filename: "airhorn.mp3",          description: "DJ airhorn blast",                category: "music" },
  { event: "cymbal_crash",    filename: "cymbal_crash.mp3",     description: "Cymbal crash accent",             category: "music" },
  { event: "drum_roll",       filename: "drum_roll.mp3",        description: "Drum roll buildup",               category: "music" },
  { event: "bass_drop",       filename: "bass_drop.mp3",        description: "Deep bass drop hit",              category: "music" },
  { event: "808_bass",        filename: "808_bass.mp3",         description: "808 sub bass tone",               category: "music" },
  { event: "kick_drum",       filename: "kick_drum.mp3",        description: "Kick drum hit",                   category: "music" },
  { event: "snare",           filename: "snare.mp3",            description: "Snare drum hit",                  category: "music" },
  { event: "hi_hat",          filename: "hi_hat.mp3",           description: "Hi-hat tick",                     category: "music" },

  // ── Extra transitions ──
  { event: "swoosh_magic",    filename: "swoosh_magic.mp3",     description: "Magical swoosh effect",           category: "transition" },
  { event: "transition_swipe",filename: "transition_swipe.mp3", description: "Swipe transition sound",          category: "transition" },
  { event: "sparkle",         filename: "sparkle.mp3",          description: "Sparkle / shimmer effect",        category: "transition" },
  { event: "pop",             filename: "pop.mp3",              description: "Quick pop accent",                category: "transition" },
  { event: "snap",            filename: "snap.mp3",             description: "Finger snap",                     category: "transition" },
  { event: "ding",            filename: "ding.mp3",             description: "Ding accent tone",                category: "transition" },

  // ── Extra ambience ──
  { event: "heavy_rain",      filename: "heavy_rain.mp3",       description: "Heavy rain downpour",             category: "weather" },
  { event: "forest_birds",    filename: "forest_birds.mp3",     description: "Forest with birdsong",            category: "nature" },
  { event: "deep_ambience",   filename: "deep_ambience.mp3",    description: "Deep dark ambience",              category: "nature" },
  { event: "crowd_ambience",  filename: "crowd_ambience.mp3",   description: "General crowd ambience",          category: "crowd" },
  { event: "static_tv",       filename: "static_tv.mp3",        description: "TV static noise",                 category: "tech" },
  { event: "sci_fi_hum",      filename: "sci_fi_hum.mp3",       description: "Sci-fi electronic hum",           category: "tech" },

  // ── Extra household/urban ──
  { event: "coin",            filename: "coin.mp3",             description: "Coin drop / collect",             category: "household" },
  { event: "click",           filename: "click.mp3",            description: "Button click",                    category: "tech" },
  { event: "beep",            filename: "beep.mp3",             description: "Short beep tone",                 category: "tech" },
  { event: "alarm_beep",      filename: "alarm_beep.mp3",       description: "Alarm beep sequence",             category: "tech" },
  { event: "siren",           filename: "siren.mp3",            description: "Emergency siren",                 category: "urban" },
  { event: "motor_rev",       filename: "motor_rev.mp3",        description: "Engine revving",                  category: "vehicle" },
  { event: "typing_key",      filename: "typing_key.mp3",       description: "Single keyboard key tap",         category: "tech" },
  { event: "bell_church",     filename: "bell_church.mp3",      description: "Church bell ring",                category: "urban" },
  { event: "error_buzz",      filename: "error_buzz.mp3",       description: "Error / wrong buzzer",            category: "tech" },
  { event: "rumble",          filename: "rumble.mp3",           description: "Low rumble / earthquake",         category: "impact" },
  { event: "boom",            filename: "boom.mp3",             description: "Deep boom impact",                category: "impact" },
  { event: "sub_bass_hit",    filename: "sub_bass_hit.mp3",     description: "Sub-bass impact hit",             category: "impact" },
  { event: "suspense_drone",  filename: "suspense_drone.mp3",   description: "Suspense drone tone",             category: "horror" },
  { event: "tension_build",   filename: "tension_build.mp3",    description: "Tension building tone",           category: "horror" },
  { event: "drum_roll_short", filename: "drum_roll_short.mp3",  description: "Short drum roll",                 category: "music" },

  // ── Priority Pack (from SFX Loading Plan — only NEW unique entries) ──
  { event: "car_engine",      filename: "car_engine.mp3",       description: "Car engine idle/drive",           category: "vehicle" },
  { event: "road_tire",       filename: "road_tire.mp3",        description: "Road tire noise on pavement",     category: "vehicle" },
  { event: "breathing_stress",filename: "breathing_stress.mp3", description: "Stressed heavy breathing",        category: "action" },
  { event: "glass_shatter",   filename: "glass_shatter.mp3",    description: "Glass shattering",                category: "impact" },
  { event: "baby_cry",        filename: "baby_cry.mp3",         description: "Baby crying",                     category: "animal" },
  { event: "keyboard_typing", filename: "keyboard_typing.mp3",  description: "Keyboard key press",              category: "tech" },
  { event: "door_slam",       filename: "door_slam.mp3",        description: "Door slamming shut",              category: "household" },
  { event: "village_ambience",filename: "village_ambience.mp3",  description: "Quiet village background",        category: "nature" },
  { event: "office_room_tone",filename: "office_room_tone.mp3", description: "Quiet office room tone",          category: "urban" },

  // ── Additional SFX (batch 2 — unique only) ──
  { event: "snake_hiss",      filename: "snake_hiss.mp3",       description: "Snake hissing",                   category: "nature" },
  { event: "footstep_gravel", filename: "footstep_gravel.mp3",  description: "Footstep on gravel",              category: "movement" },
  { event: "wood_crack",      filename: "wood_crack.mp3",       description: "Wood cracking / branch break",    category: "nature" },
  { event: "water_splash",    filename: "water_splash.mp3",     description: "Water splash",                    category: "nature" },
  { event: "children_laugh",  filename: "children_laugh.mp3",   description: "Children laughing",               category: "children" },
  { event: "school_bell",     filename: "school_bell.mp3",      description: "School bell ring",                category: "children" },
  { event: "page_turn",       filename: "page_turn.mp3",        description: "Book page turning",               category: "children" },

  // ── Expansion Pack: Piano & Instruments ──
  { event: "piano_hit",         filename: "piano_hit.mp3",        description: "Single piano key hit",             category: "music" },
  { event: "piano_chord",       filename: "piano_chord.mp3",      description: "Soft piano chord",                 category: "music" },
  { event: "piano_bed",         filename: "piano_bed.mp3",        description: "Gentle piano bed loop",            category: "music" },
  { event: "guitar_strum",      filename: "guitar_strum.mp3",     description: "Acoustic guitar strum",            category: "music" },
  { event: "violin_sustain",    filename: "violin_sustain.mp3",   description: "Violin sustained note",            category: "music" },
  { event: "harp_gliss",        filename: "harp_gliss.mp3",       description: "Harp glissando",                   category: "music" },
  { event: "flute_trill",       filename: "flute_trill.mp3",      description: "Flute trill",                      category: "music" },
  { event: "drum_fill",         filename: "drum_fill.mp3",        description: "Quick drum fill",                  category: "music" },

  // ── Background Music Tracks (20s loops — for video production) ──
  { event: "music_calm_ambient",   filename: "music_calm_ambient.mp3",    description: "Calm ambient pad — relaxing, meditation, nature",  category: "music" },
  { event: "music_cinematic_epic", filename: "music_cinematic_epic.mp3",  description: "Cinematic epic drone — drama, action, movie",      category: "music" },
  { event: "music_gospel_warm",    filename: "music_gospel_warm.mp3",     description: "Warm gospel harmonics — worship, inspiration",     category: "music" },
  { event: "music_afrobeat_groove",filename: "music_afrobeat_groove.mp3", description: "Afrobeat groove — dance, energy, African vibe",    category: "music" },
  { event: "music_soft_piano",     filename: "music_soft_piano.mp3",      description: "Soft piano melody — emotional, story, wedding",    category: "music" },
  { event: "music_motivational",   filename: "music_motivational.mp3",    description: "Motivational rise — business, fitness, success",   category: "music" },
  { event: "music_children_happy", filename: "music_children_happy.mp3",  description: "Happy children music — kids, learning, fun",       category: "music" },
  { event: "music_dark_suspense",  filename: "music_dark_suspense.mp3",   description: "Dark suspense drone — horror, thriller, mystery",  category: "music" },
  { event: "music_corporate",      filename: "music_corporate.mp3",       description: "Corporate light — professional, presentation",     category: "music" },

  // ── Expansion: Whooshes & Risers ──
  { event: "whoosh_fast",       filename: "whoosh_fast.mp3",      description: "Fast whoosh pass-by",              category: "transition" },
  { event: "whoosh_slow",       filename: "whoosh_slow.mp3",      description: "Slow ethereal whoosh",             category: "transition" },
  { event: "whoosh_heavy",      filename: "whoosh_heavy.mp3",     description: "Heavy impact whoosh",              category: "transition" },
  { event: "riser_tonal",       filename: "riser_tonal.mp3",      description: "Tonal riser buildup",              category: "transition" },
  { event: "riser_noise",       filename: "riser_noise.mp3",      description: "Noise riser tension",              category: "transition" },
  { event: "riser_reverse",     filename: "riser_reverse.mp3",    description: "Reverse cymbal riser",             category: "transition" },
  { event: "impact_hit",        filename: "impact_hit.mp3",       description: "Heavy cinematic impact",           category: "impact" },
  { event: "impact_low",        filename: "impact_low.mp3",       description: "Low frequency impact boom",        category: "impact" },
  { event: "impact_glass",      filename: "impact_glass.mp3",     description: "Glass shatter impact",             category: "impact" },

  // ── Expansion: Footsteps ──
  { event: "footsteps_wood",    filename: "footsteps_wood.mp3",   description: "Footsteps on wooden floor",        category: "movement" },
  { event: "footsteps_carpet",  filename: "footsteps_carpet.mp3", description: "Soft footsteps on carpet",         category: "movement" },
  { event: "footsteps_concrete",filename: "footsteps_concrete.mp3",description: "Footsteps on concrete",           category: "movement" },
  { event: "footsteps_grass",   filename: "footsteps_grass.mp3",  description: "Footsteps on grass",               category: "movement" },
  { event: "footsteps_sand",    filename: "footsteps_sand.mp3",   description: "Footsteps on sand",                category: "movement" },
  { event: "footsteps_puddle",  filename: "footsteps_puddle.mp3", description: "Footsteps in puddle/wet",          category: "movement" },
  { event: "footsteps_run",     filename: "footsteps_run.mp3",    description: "Running footsteps",                category: "movement" },

  // ── Expansion: Wind & Weather Variants ──
  { event: "wind_gentle",       filename: "wind_gentle.mp3",      description: "Gentle breeze",                    category: "weather" },
  { event: "wind_strong",       filename: "wind_strong.mp3",      description: "Strong wind gusts",                category: "weather" },
  { event: "wind_howling",      filename: "wind_howling.mp3",     description: "Howling wind through structure",    category: "weather" },
  { event: "rain_medium",       filename: "rain_medium.mp3",      description: "Medium steady rain",               category: "weather" },
  { event: "rain_on_roof",      filename: "rain_on_roof.mp3",     description: "Rain on metal/tin roof",           category: "weather" },
  { event: "rain_on_window",    filename: "rain_on_window.mp3",   description: "Rain on glass window",             category: "weather" },
  { event: "storm",             filename: "storm.mp3",            description: "Full storm with thunder",           category: "weather" },
  { event: "hail",              filename: "hail.mp3",             description: "Hailstones hitting surface",        category: "weather" },

  // ── Expansion: Crowd & Ambience Variants ──
  { event: "crowd_cheer",       filename: "crowd_cheer.mp3",      description: "Crowd cheering",                   category: "crowd" },
  { event: "crowd_panic",       filename: "crowd_panic.mp3",      description: "Crowd panic / screaming",          category: "crowd" },
  { event: "crowd_murmur",      filename: "crowd_murmur.mp3",     description: "Indoor crowd murmur",              category: "crowd" },
  { event: "crowd_applause",    filename: "crowd_applause.mp3",   description: "Audience applause",                category: "crowd" },
  { event: "market_noise",      filename: "market_noise.mp3",     description: "Busy market ambience",             category: "nigerian" },
  { event: "market_haggling",   filename: "market_haggling.mp3",  description: "Market haggling voices",           category: "nigerian" },
  { event: "city_ambience",     filename: "city_ambience.mp3",    description: "City street ambience",             category: "urban" },
  { event: "village_ambience",  filename: "village_ambience.mp3", description: "Quiet village ambience",           category: "nature" },
  { event: "office_ambience",   filename: "office_ambience.mp3",  description: "Office room tone / AC hum",        category: "urban" },
  { event: "restaurant_ambience", filename: "restaurant_ambience.mp3", description: "Restaurant background noise", category: "urban" },
  { event: "cafe_ambience",     filename: "cafe_ambience.mp3",    description: "Coffee shop ambience",             category: "urban" },

  // ── Expansion: Household & Domestic ──
  { event: "door_open",         filename: "door_open.mp3",        description: "Door opening / handle turn",       category: "household" },
  { event: "door_close",        filename: "door_close.mp3",       description: "Door closing",                     category: "household" },
  { event: "door_slam",         filename: "door_slam.mp3",        description: "Door slamming hard",               category: "household" },
  { event: "door_creak",        filename: "door_creak.mp3",       description: "Creaky door opening slowly",       category: "household" },
  { event: "key_lock",          filename: "key_lock.mp3",         description: "Key turning in lock",              category: "household" },
  { event: "glass_clink",       filename: "glass_clink.mp3",      description: "Glasses clinking / toast",         category: "household" },
  { event: "plate_clink",       filename: "plate_clink.mp3",      description: "Plates and cutlery",               category: "household" },
  { event: "water_tap",         filename: "water_tap.mp3",        description: "Water running from tap",           category: "household" },
  { event: "kettle_boil",       filename: "kettle_boil.mp3",      description: "Kettle boiling / whistle",         category: "household" },
  { event: "fridge_hum",        filename: "fridge_hum.mp3",       description: "Refrigerator hum",                 category: "household" },
  { event: "microwave_beep",    filename: "microwave_beep.mp3",   description: "Microwave done beep",              category: "household" },
  { event: "fan_spinning",      filename: "fan_spinning.mp3",     description: "Ceiling / standing fan",           category: "household" },

  // ── Expansion: Vehicles ──
  { event: "car_start",         filename: "car_start.mp3",        description: "Car engine starting",              category: "vehicle" },
  { event: "car_idle",          filename: "car_idle.mp3",         description: "Car engine idling",                category: "vehicle" },
  { event: "car_drive",         filename: "car_drive.mp3",        description: "Car driving steady",               category: "vehicle" },
  { event: "car_horn",          filename: "car_horn.mp3",         description: "Car horn honk",                    category: "vehicle" },
  { event: "car_brake",         filename: "car_brake.mp3",        description: "Car braking / screech",            category: "vehicle" },
  { event: "car_door",          filename: "car_door.mp3",         description: "Car door open/close",              category: "vehicle" },
  { event: "motorcycle",        filename: "motorcycle.mp3",       description: "Motorcycle engine",                category: "vehicle" },
  { event: "truck_passby",      filename: "truck_passby.mp3",     description: "Truck passing by",                 category: "vehicle" },
  { event: "helicopter",        filename: "helicopter.mp3",       description: "Helicopter overhead",              category: "vehicle" },
  { event: "boat_engine",       filename: "boat_engine.mp3",      description: "Boat motor running",               category: "vehicle" },
  { event: "bicycle_bell",      filename: "bicycle_bell.mp3",     description: "Bicycle bell ring",                category: "vehicle" },

  // ── Expansion: Animals ──
  { event: "dog_bark",          filename: "dog_bark.mp3",         description: "Dog barking",                      category: "animal" },
  { event: "dog_whimper",       filename: "dog_whimper.mp3",      description: "Dog whimpering",                   category: "animal" },
  { event: "cat_meow",          filename: "cat_meow.mp3",         description: "Cat meowing",                      category: "animal" },
  { event: "cat_purr",          filename: "cat_purr.mp3",         description: "Cat purring",                      category: "animal" },
  { event: "rooster",           filename: "rooster.mp3",          description: "Rooster crowing",                  category: "animal" },
  { event: "goat_bleat",        filename: "goat_bleat.mp3",       description: "Goat bleating",                    category: "animal" },
  { event: "cow_moo",           filename: "cow_moo.mp3",          description: "Cow mooing",                       category: "animal" },
  { event: "birds_chirping",    filename: "birds_chirping.mp3",   description: "Birds chirping (morning)",         category: "animal" },
  { event: "owl_hoot",          filename: "owl_hoot.mp3",         description: "Owl hooting (night)",              category: "animal" },
  { event: "cricket_night",     filename: "cricket_night.mp3",    description: "Crickets at night",                category: "animal" },
  { event: "frog_croak",        filename: "frog_croak.mp3",       description: "Frog croaking",                    category: "animal" },
  { event: "mosquito_buzz",     filename: "mosquito_buzz.mp3",    description: "Mosquito buzzing",                 category: "animal" },

  // ── Expansion: Nature ──
  { event: "ocean_waves",       filename: "ocean_waves.mp3",      description: "Ocean waves crashing on shore",    category: "nature" },
  { event: "river_stream",      filename: "river_stream.mp3",     description: "Flowing river / stream",           category: "nature" },
  { event: "waterfall",         filename: "waterfall.mp3",        description: "Waterfall ambience",               category: "nature" },
  { event: "fire_campfire",     filename: "fire_campfire.mp3",    description: "Campfire crackling",               category: "nature" },
  { event: "leaves_rustling",   filename: "leaves_rustling.mp3",  description: "Leaves rustling in wind",          category: "nature" },
  { event: "branch_snap",       filename: "branch_snap.mp3",      description: "Tree branch snapping",             category: "nature" },

  // ── Expansion: School & Education ──
  { event: "school_ambience",   filename: "school_ambience.mp3",  description: "School corridor ambience",         category: "children" },
  { event: "classroom_ambience",filename: "classroom_ambience.mp3",description: "Classroom with children",         category: "children" },
  { event: "pencil_writing",    filename: "pencil_writing.mp3",   description: "Pencil writing on paper",          category: "children" },
  { event: "chalk_board",       filename: "chalk_board.mp3",      description: "Chalk writing on blackboard",      category: "children" },
  { event: "children_singing",  filename: "children_singing.mp3", description: "Children singing together",        category: "children" },
  { event: "correct_ding",      filename: "correct_ding.mp3",     description: "Correct answer ding",              category: "children" },
  { event: "wrong_buzz",        filename: "wrong_buzz.mp3",       description: "Wrong answer buzz",                category: "children" },
  { event: "clapping",          filename: "clapping.mp3",         description: "Clapping / applause",              category: "children" },
  { event: "toy_squeak",        filename: "toy_squeak.mp3",       description: "Toy squeak",                       category: "children" },
  { event: "balloon_pop",       filename: "balloon_pop.mp3",      description: "Balloon popping",                  category: "children" },
  { event: "xylophone_note",    filename: "xylophone_note.mp3",   description: "Xylophone single note",            category: "children" },
  { event: "tambourine",        filename: "tambourine.mp3",       description: "Tambourine shake",                 category: "children" },

  // ── Expansion: Tech & UI ──
  { event: "keyboard_typing",   filename: "keyboard_typing.mp3",  description: "Keyboard typing rapid",            category: "tech" },
  { event: "mouse_click",       filename: "mouse_click.mp3",      description: "Mouse button click",               category: "tech" },
  { event: "phone_vibrate",     filename: "phone_vibrate.mp3",    description: "Phone vibrating on table",         category: "tech" },
  { event: "notification_soft", filename: "notification_soft.mp3", description: "Soft notification sound",         category: "tech" },
  { event: "power_up",          filename: "power_up.mp3",         description: "Power up / level up sound",        category: "tech" },
  { event: "power_down",        filename: "power_down.mp3",       description: "Power down / shutdown",            category: "tech" },
  { event: "glitch",            filename: "glitch.mp3",           description: "Digital glitch / distortion",      category: "tech" },

  // ── Expansion: Action & Combat ──
  { event: "gunshot_pistol",    filename: "gunshot_pistol.mp3",   description: "Pistol single shot",               category: "weapon" },
  { event: "gunshot_rifle",     filename: "gunshot_rifle.mp3",    description: "Rifle shot",                       category: "weapon" },
  { event: "gunshot_burst",     filename: "gunshot_burst.mp3",    description: "Automatic burst fire",             category: "weapon" },
  { event: "gunshot_distant",   filename: "gunshot_distant.mp3",  description: "Distant gunshot echo",             category: "weapon" },
  { event: "sword_draw",        filename: "sword_draw.mp3",       description: "Sword drawing from sheath",        category: "weapon" },
  { event: "sword_swing",       filename: "sword_swing.mp3",      description: "Sword swinging through air",       category: "weapon" },
  { event: "shield_block",      filename: "shield_block.mp3",     description: "Shield blocking impact",           category: "weapon" },
  { event: "arrow_release",     filename: "arrow_release.mp3",    description: "Arrow released from bow",          category: "weapon" },
  { event: "punch",             filename: "punch.mp3",            description: "Fist punch impact",                category: "action" },
  { event: "body_fall",         filename: "body_fall.mp3",        description: "Body falling / collapse",          category: "action" },
  { event: "chain_rattle",      filename: "chain_rattle.mp3",     description: "Chain rattling",                   category: "action" },
  { event: "cloth_movement",    filename: "cloth_movement.mp3",   description: "Cloth / fabric movement",          category: "movement" },
  { event: "paper_rustle",      filename: "paper_rustle.mp3",     description: "Paper rustling",                   category: "movement" },

  // ── Expansion: Horror & Tension ──
  { event: "horror_sting",      filename: "horror_sting.mp3",     description: "Horror sting / jump scare",        category: "horror" },
  { event: "breath_heavy",      filename: "breath_heavy.mp3",     description: "Heavy breathing / panting",        category: "horror" },
  { event: "whisper",           filename: "whisper.mp3",          description: "Whispering voice (eerie)",         category: "horror" },
  { event: "glass_break",       filename: "glass_break.mp3",      description: "Glass breaking",                   category: "horror" },
  { event: "metal_scrape",      filename: "metal_scrape.mp3",     description: "Metal scraping on surface",        category: "horror" },
  { event: "floor_creak",       filename: "floor_creak.mp3",      description: "Wooden floor creaking",            category: "horror" },

  // ── Expansion: Nigerian / African ──
  { event: "talking_drum",      filename: "talking_drum.mp3",     description: "Nigerian talking drum",            category: "nigerian" },
  { event: "shekere",           filename: "shekere.mp3",          description: "Shekere (gourd shaker)",           category: "nigerian" },
  { event: "agogo_bell",        filename: "agogo_bell.mp3",       description: "Agogo bell",                       category: "nigerian" },
  { event: "palm_wine_pour",    filename: "palm_wine_pour.mp3",   description: "Liquid pouring into calabash",     category: "nigerian" },
  { event: "danfo_horn",        filename: "danfo_horn.mp3",       description: "Lagos danfo bus horn",             category: "nigerian" },
  { event: "generator_hum",     filename: "generator_hum.mp3",    description: "Generator running (NEPA)",         category: "nigerian" },
  { event: "call_to_prayer",    filename: "call_to_prayer.mp3",   description: "Distant call to prayer",           category: "nigerian" },
  { event: "church_bell",       filename: "church_bell.mp3",      description: "Church bell ringing",              category: "urban" },
];

const SFX_MAP = new Map<string, SFXFile>(SFX_LIBRARY.map(s => [s.event, s]));

export function getSFXPath(event: string): string | null {
  const entry = SFX_MAP.get(event);
  if (!entry) return null;
  const fullPath = path.join(env.storagePath, "sfx", entry.filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

// Resolve a list of event names to available local paths (skips missing files)
export function resolveSFXPaths(events: string[]): string[] {
  const paths: string[] = [];
  for (const event of events) {
    const p = getSFXPath(event);
    if (p) paths.push(p);
    else console.warn(`[SFX] File not found for event "${event}" — skipping`);
  }
  return paths;
}

// List available SFX events (files that actually exist in storage/sfx/)
export function listAvailableSFX(): SFXFile[] {
  return SFX_LIBRARY.filter(s => {
    const p = path.join(env.storagePath, "sfx", s.filename);
    return fs.existsSync(p);
  });
}

// ── Source note sidecar ─────────────────────────────────────────────────────
// Reads storage/sfx/sources.json — written by the UI via /api/sfx/source-notes.
// Returns empty object on missing or malformed file (never throws).

export interface SFXSourceNote {
  key: string;
  filename: string;
  sourceSite: string;
  sourceUrl: string;
  attributionNote: string;
  importNote: string;
  safeForAutoMode: boolean;
  qualityRating: "" | "low" | "good" | "excellent";
  updatedAt?: string;
}

function loadSourceNotes(): Record<string, SFXSourceNote> {
  const sidecarPath = path.join(env.storagePath, "sfx", "sources.json");
  if (!fs.existsSync(sidecarPath)) return {};
  try {
    const raw = fs.readFileSync(sidecarPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, SFXSourceNote>;
  } catch {
    return {};
  }
}

// Auto-selection resolver — only returns paths for events explicitly marked
// safeForAutoMode: true in sources.json.
// Used by the pipeline for supervisor-detected events (auto-mapped from script text).
// Manual [SFX: event] script tags bypass this check — use resolveSFXPaths() for those.
export function resolveAutoSFXPaths(events: string[]): string[] {
  const notes = loadSourceNotes();
  const paths: string[] = [];
  for (const event of events) {
    const note = notes[event];
    if (!note?.safeForAutoMode) {
      console.warn(`[SFX Auto] "${event}" not marked safe for auto mode — skipping auto-use`);
      continue;
    }
    const p = getSFXPath(event);
    if (p) paths.push(p);
    else console.warn(`[SFX Auto] File not found for event "${event}" — skipping`);
  }
  return paths;
}
