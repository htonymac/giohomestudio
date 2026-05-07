export const AID_VIDEO_MODELS: Array<{
  id: string; name: string; price: number; network: "Segmind"|"MuAPI"|"FAL"|"Runway"|"Kling";
  res: string; maxSec: number; color: string;
  scores: { "2d": number; "3d": number; cartoon: number; realistic: number };
  tags2d?: string; tags3d?: string; tagCartoon?: string; tagRealistic?: string;
}> = [
  { id:"segmind_pruna_video",     name:"Pruna P Video",       price:0.005, network:"Segmind", res:"720p",   maxSec:15, color:"#22c55e", scores:{"2d":2,"3d":1,"cartoon":3,"realistic":1}, tags2d:"drafts only", tagCartoon:"budget cartoon draft" },
  { id:"muapi_seedance_lite",     name:"Seedance Lite",       price:0.020, network:"MuAPI",   res:"480p",   maxSec:5,  color:"#6ee7b7", scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2}, tags2d:"cheap Seedance draft", tagCartoon:"cheap animated motion" },
  { id:"fal_wan_lite",            name:"Wan Lite 1.3B",       price:0.025, network:"FAL",     res:"480p",   maxSec:5,  color:"#4ade80", scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2}, tags2d:"budget Wan draft", tagCartoon:"cheap Wan motion" },
  { id:"muapi_wan_v2_1_480p",     name:"Wan 2.1 480p",        price:0.03,  network:"MuAPI",   res:"480p",   maxSec:5,  color:"#34d399", scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2}, tags2d:"cheap 2D draft", tagCartoon:"cheap animated draft" },
  { id:"muapi_seedance_v1_pro",   name:"Seedance 1.0 Pro",    price:0.04,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#4ade80", scores:{"2d":4,"3d":2,"cartoon":4,"realistic":2}, tags2d:"clean flat motion", tagCartoon:"smooth cartoon motion" },
  { id:"muapi_wan_v2_1_720p",     name:"Wan 2.1 720p",        price:0.05,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#2dd4bf", scores:{"2d":3,"3d":3,"cartoon":3,"realistic":3}, tags2d:"solid 2D", tags3d:"budget 3D scenes", tagRealistic:"basic realism" },
  { id:"muapi_seedance_v2",       name:"Seedance 2.0",        price:0.08,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#38bdf8", scores:{"2d":5,"3d":3,"cartoon":5,"realistic":3}, tags2d:"BEST 2D on MuAPI", tagCartoon:"BEST cartoon on MuAPI", tags3d:"decent 3D" },
  { id:"muapi_seedance_v2_1080p", name:"Seedance 2.0 1080p",  price:0.12,  network:"MuAPI",   res:"1080p",  maxSec:5,  color:"#60a5fa", scores:{"2d":5,"3d":4,"cartoon":5,"realistic":4}, tags2d:"BEST 2D full HD", tagCartoon:"BEST cartoon HD", tags3d:"good 3D detail", tagRealistic:"cinematic realism" },
  { id:"fal_hailuo_standard",     name:"Hailuo Standard",     price:0.05,  network:"FAL",     res:"720p",   maxSec:6,  color:"#a3e635", scores:{"2d":3,"3d":3,"cartoon":4,"realistic":2}, tagCartoon:"expressive cartoon", tags2d:"stylized 2D" },
  { id:"fal_kling_2_5_standard",  name:"Kling 2.5 Standard",  price:0.10,  network:"FAL",     res:"1080p",  maxSec:10, color:"#facc15", scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4}, tags3d:"solid 3D scenes", tagRealistic:"good realism, 10s" },
  { id:"fal_hailuo_pro",          name:"Hailuo Pro",          price:0.15,  network:"FAL",     res:"1080p",  maxSec:6,  color:"#fb923c", scores:{"2d":4,"3d":3,"cartoon":5,"realistic":3}, tagCartoon:"premium cartoon quality", tags2d:"expressive 2D" },
  { id:"fal_wan_pro",             name:"Wan Pro",             price:0.12,  network:"FAL",     res:"1080p",  maxSec:10, color:"#f472b6", scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4}, tags3d:"smooth 3D, 10s", tagRealistic:"natural motion, 10s" },
  { id:"fal_kling_2_5_turbo_pro", name:"Kling 2.5 Turbo",     price:0.20,  network:"FAL",     res:"1080p",  maxSec:10, color:"#a78bfa", scores:{"2d":4,"3d":5,"cartoon":3,"realistic":5}, tags3d:"premium 3D fast", tagRealistic:"high realism, fast" },
  { id:"fal_kling_3_pro",         name:"Kling 3.0 Pro",       price:0.30,  network:"FAL",     res:"1080p",  maxSec:10, color:"#c084fc", scores:{"2d":4,"3d":5,"cartoon":4,"realistic":5}, tags3d:"TOP 3D cinematic", tagRealistic:"TOP realism on FAL", tagCartoon:"cinematic cartoon" },
  { id:"fal_runway_gen4",         name:"Runway Gen-4 (FAL)",  price:0.25,  network:"FAL",     res:"1080p",  maxSec:10, color:"#d946ef", scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5}, tags3d:"cinematic 3D", tagRealistic:"near-photorealistic" },
  { id:"runway_gen4_direct",      name:"Runway Direct ★",     price:0,     network:"Runway",  res:"720p",   maxSec:10, color:"#e879f9", scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5}, tags3d:"YOUR CREDITS — cinematic 3D", tagRealistic:"YOUR CREDITS — best realistic" },
  { id:"kling_direct_v1_5_std",   name:"Kling 1.6 Direct ★",  price:0.045, network:"Kling",   res:"720p",   maxSec:10, color:"#fbbf24", scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4}, tags3d:"direct Kling 3D", tagRealistic:"direct API realism" },
  { id:"kling_direct_v2_5_std",   name:"Kling 2.5 Direct ★",  price:0.10,  network:"Kling",   res:"1080p",  maxSec:10, color:"#f59e0b", scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5}, tags3d:"BEST direct 3D cinematic", tagRealistic:"TOP direct realism, 10s" },
  { id:"kling_direct_v2_5_pro",   name:"Kling 2.5 Pro ★",     price:0.20,  network:"Kling",   res:"1080p",  maxSec:10, color:"#d97706", scores:{"2d":4,"3d":5,"cartoon":4,"realistic":5}, tags3d:"TOP 3D — premium Kling", tagRealistic:"HIGHEST direct realism", tagCartoon:"cinematic cartoon premium" },
];

export const AID_IMAGE_MODELS = [
  { id:"segmind_pruna",          name:"Pruna P Image",        price:0.005, network:"Segmind", res:"1024px", color:"#22c55e", desc:"Cheapest image. Fast drafts." },
  { id:"fal_flux_schnell",       name:"Flux Schnell",         price:0.003, network:"FAL",     res:"1024px", color:"#4ade80", desc:"Fastest FAL image. Very cheap." },
  { id:"fal_flux_dev",           name:"Flux Dev",             price:0.025, network:"FAL",     res:"1024px", color:"#facc15", desc:"Better detail. Good balance." },
  { id:"fal_ideogram_v3_turbo",  name:"Ideogram v3 Turbo",    price:0.020, network:"FAL",     res:"1024px", color:"#fb923c", desc:"Best text rendering. Titles/posters." },
  { id:"fal_seedream",           name:"Seedream",             price:0.020, network:"FAL",     res:"1024px", color:"#38bdf8", desc:"Polished commercial stills." },
  { id:"fal_nano_banana",        name:"Nano Banana 2",        price:0.030, network:"FAL",     res:"1024px", color:"#a78bfa", desc:"Strong generation + editing." },
  { id:"fal_flux_pro",           name:"Flux Pro",             price:0.050, network:"FAL",     res:"1024px", color:"#c084fc", desc:"Top-tier Flux. Best photorealism." },
  { id:"fal_ideogram_v3_quality",name:"Ideogram v3 Quality",  price:0.040, network:"FAL",     res:"1024px", color:"#d946ef", desc:"High quality text + branded graphics." },
  { id:"fal_recraft_v3",         name:"Recraft v3",           price:0.040, network:"FAL",     res:"1024px", color:"#e879f9", desc:"Design-style product illustrations." },
  { id:"fal_flux_pro_ultra",     name:"Flux Pro Ultra",       price:0.060, network:"FAL",     res:"2048px", color:"#f472b6", desc:"Highest resolution. Print quality." },
];
