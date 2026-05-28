// Verify the final_merge AUDIO + video-copy path (-c:v copy -c:a aac) works after the
// perf change. A few real images + a stock music track → output must have a video AND
// an audio stream, success:true.
import fs from "fs"; import path from "path";
const ROOT = "/home/ghs/giohomestudio";
const SCENES = path.join(ROOT, "storage/scenes/unlinked");
const imgs = [];
(function w(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})){ if(imgs.length>=5)return; const p=path.join(d,e.name); if(e.isDirectory())w(p); else if(/\.(png|jpe?g)$/i.test(e.name)&&fs.statSync(p).size>2000) imgs.push(p);}})(SCENES);
const toUrl = a => "/api/media/" + path.relative(path.join(ROOT,"storage"), a);
const segs=[]; let t=0;
imgs.forEach((p,i)=>{ segs.push({id:`seg_${i}`,type:"image",sourceUrl:toUrl(p),startTime:t,endTime:t+3,duration:3,sceneId:`SC${i}`,transitionIn:i===0?"fade":"cut",transitionOut:"cut"}); t+=3; });
const assembly={version:1,projectId:"audiomergetest",projectType:"hybrid",title:"Audio Merge",totalDuration:t,aspectRatio:"16:9",resolution:{width:1920,height:1080},
  segments:segs, narration:[],
  music:[{id:"m0",sourceUrl:"/api/media/music/stock/upbeat.mp3",startTime:0,endTime:t,volume:0.4,fadeIn:1,fadeOut:2,duckUnderSpeech:false,duckLevel:0.08,licenseType:"cc0"}],
  sfx:[],ambience:[],subtitles:[],overlays:[],volumeAutomation:[],
  duckingRules:{narrationPriority:true,musicDuckLevel:0.08,ambienceDuckLevel:0.12,sfxDuckLevel:0.15},
  exportSettings:{format:"mp4",quality:"standard",includeSubtitles:false,includeWatermark:false,includeCredits:false,subtitleStyle:"none"},
  plannerTier:"standard",soundLicenses:[],rightsConfirmed:true,previewApproved:true,exportApproved:true};
const t0=Date.now();
const res=await fetch("http://localhost:3200/api/assembly/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({assembly,skipApprovalCheck:true}),signal:AbortSignal.timeout(120000)});
const text=await res.text(); let r=null; for(const l of text.split("\n")){const s=l.trim(); if(!s)continue; try{const o=JSON.parse(s); if(o.result)r=o.result;}catch{}}
console.log("took", ((Date.now()-t0)/1000).toFixed(0)+"s | success:", r?.success, "| segs:", r?.assembly?.segments, "| outputUrl:", r?.outputUrl);
console.log("VERDICT:", (r?.success && r?.outputUrl) ? "AUDIO MERGE OK ✓ (will probe streams next)" : "FAILED ✗");
