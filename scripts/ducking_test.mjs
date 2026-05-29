// Validate narrator-ducking: assembly with a long narrator (t=0) + a short "actor" clip
// (t=5). Confirms the volume:enable ducking filter builds + the narration mix completes
// (a malformed enable expr would fail mix_narration → no audio). Also probes final streams.
import fs from "fs"; import path from "path";
const ROOT = "/home/ghs/giohomestudio";
const SCENES = path.join(ROOT, "storage/scenes/unlinked");
const NARR = path.join(ROOT, "storage/narration");
const imgs = [];
(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){if(imgs.length>=3)return;const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(/\.(png|jpe?g)$/i.test(e.name)&&fs.statSync(p).size>2000)imgs.push(p);}})(SCENES);
const wavs = fs.readdirSync(NARR).filter(f=>/\.wav$/i.test(f)).sort();
const toUrl = a => "/api/media/" + path.relative(path.join(ROOT,"storage"), a);
const narratorUrl = "/api/media/narration/" + wavs[0];
const actorUrl = "/api/media/narration/" + (wavs[1] || wavs[0]);
const segs = imgs.map((p,i)=>({id:`seg_${i}`,type:"image",sourceUrl:toUrl(p),startTime:i*7,endTime:i*7+7,duration:7,sceneId:`SC${i}`,transitionIn:i===0?"fade":"cut",transitionOut:"cut"}));
const assembly = {version:1,projectId:"duckingtest",projectType:"hybrid",title:"Ducking",totalDuration:21,aspectRatio:"16:9",resolution:{width:1920,height:1080},
  segments:segs,
  narration:[
    {id:"nar_0",text:"narrator full track",startTime:0,endTime:21,volume:1.0,speed:1.0,audioUrl:narratorUrl,isNarrator:true},
    {id:"nar_1",text:"actor line",startTime:5,endTime:13,volume:1.0,speed:1.0,audioUrl:actorUrl},
  ],
  music:[],sfx:[],ambience:[],subtitles:[],overlays:[],volumeAutomation:[],
  duckingRules:{narrationPriority:true,musicDuckLevel:0.08,ambienceDuckLevel:0.12,sfxDuckLevel:0.15},
  exportSettings:{format:"mp4",quality:"standard",includeSubtitles:false,includeWatermark:false,includeCredits:false,subtitleStyle:"none"},
  plannerTier:"standard",soundLicenses:[],rightsConfirmed:true,previewApproved:true,exportApproved:true};
const res=await fetch("http://localhost:3200/api/assembly/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({assembly,skipApprovalCheck:true}),signal:AbortSignal.timeout(120000)});
const text=await res.text();let r=null;for(const l of text.split("\n")){const s=l.trim();if(!s)continue;try{const o=JSON.parse(s);if(o.result)r=o.result;}catch{}}
const steps=(r?.steps||[]);
const mixNarr = steps.find(s=>s.id==="mix_narration");
console.log("success:", r?.success, "| mix_narration:", mixNarr?.status || "(absent)", "| narration entries:", r?.assembly?.narration);
console.log("outputUrl:", r?.outputUrl);
