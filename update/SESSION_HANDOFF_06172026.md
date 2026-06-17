# GHS Session Handoff — 2026-06-16/17 (read this first on restart)

Long autonomous session. Everything below is LIVE on andiostudio.com unless marked.
On restart: brain_query('ghs','overview') + read this file. Do NOT re-ask answered things.

## 0. Henry's standing rules locked THIS session (do not violate)
- **Music licence: ONLY CC0 / Public Domain / Pixabay License / Mixkit License. NO CC-BY, EVER.**
  Jamendo + Freesound(music) DROPPED (CC-BY). FreePD quarantined (CC-BY/Kevin MacLeod = YouTube Content-ID magnet).
- **Don't lose / move Henry's existing images. Don't let one project's images infect another story.**
- **Each project / each chat session = its own folder.**
- **manifest.json (storage/music/stock/manifest.json) is GIT-TRACKED — server-side edits are wiped by the deploy git reset. Always change music manifest IN GIT.**
- **Do NOT deploy / restart ghs.service while Henry is rendering** — `systemctl restart ghs` kills in-progress assembly.
- Children ABC/phonics = a TEACHING script (A is for Apple...), NEVER a story/villain.
- Plain English to Henry. Caveman/terse. Brain-first + write-back (R7). Don't ask stupid questions on restart.
- Branding: GHS Standard/Plus/Pro/Premium/Best user-facing; but Henry (owner) wants to SEE real engine (Edge/ElevenLabs) + free/paid.

## 1. SHIPPED & LIVE this session (PRs, all merged + deployed)
- #115 image lean prompt: dropped "professional cinema camera" from realistic style prefix (was drawing literal film crews) + crew/phone-crowd negatives.
- #117 + #121 "Clear Ghost Images/Audio/Video" now PERSIST: new PATCH /api/hybrid/saved-state drops the keys server-side (was relying on a flaky 50KB autosave). Also clears Gen Max localStorage backup + per-character audio.
- #119 Hybrid lean prompt mirrors Free Mode EXACTLY: removed the "Faces:" plural cue (spawned crowds) + the "NOT posing/photo/portrait" negation stack (induced posing); proper-case names. Verified Mara/Cobra 2-person action.
- #123 quarantined 17 unverified stock tracks (incl epic_orchestral.mp3 that got a real YouTube Content-ID claim); catalog serves verified-only + youtubeContentIdWarning.
- #124 AI music: surfaces real failure (FAL "Exhausted balance" 403) instead of silently passing stock off as AI.
- #125 ABC flashcard image overlay: big "A a" + picture + word, text CODE-DRAWN (perfect spelling).
- #126 ABC Flashcard Builder UI (children Design tab): A-Z grid, auto kid words (swappable), Generate.
- #127 lean identity hint: Cobra no longer renders as a SNAKE (short visualDescription clause + animal-name→"a person" guard).
- #128 narration/image sync: Gen Max beats SHARE the scene's narration slice (was fixed 3s/beat → images outran narration).
- #129 /api/music/license endpoint + downloadable HTML certificate.
- #131 Music Library tab (Music Studio) shows licence + certificate download; merges stock + registry. Plus the 19 Internet Archive tracks given CC0 verified records IN GIT manifest.
- #132 upload-with-licence: POST /api/music/upload (refuses CC-BY) + shared license-registry helper (storage/music/license-registry.json) + AI-gen writes a record + library merges registry.
- #133 karaoke AI-music writes a licence record.
- #134 narration intro-offset: voices start AFTER the intro card so narration ends with the story (music looped to full movie).
- #135 children music kid-appropriate by mood: 7 tracks tagged childrenSafe+childMood (calm/playful/upbeat); /api/music/stock?children=1&mood=X; children planner picks by mood.
- #136 children per-project image isolation: all children image/video calls use stable activeProjectIdRef.current (was no/ephemeral projectId → dumped to shared scenes/unlinked).
- #137 image isolation MIRROR to series-wizard/music-video/commercial/movie planners.
- #138 free-mode per-session image folder: /api/generation/image takes a `folder` param → storage/images/{sessionId}/; free-mode passes its sessionId (+ via HybridModal prop).
- #139 ABC cards narration+subtitle+music in one rhythm: generateAbcScenes sets narrationText, auto-narrates, auto-picks a kid music track.
- #140 children-video topics → full A-Z concepts (Letters A-Z, Letter Sounds A-Z, Many Words A-Z, Magic Words A-Z, ABC Call&Response A-Z, First Letter of My Name A-Z, Subject Alphabet Animals A-Z, Letters in My Family A-Z + NEW Image Alphabet A-Z + Vocabulary A-Z). Replaced fragmented A.B.C / Word-Magic pills.
- #141 children "AI don't listen" FIX: expandContent now sends contentType (derived from URL ?content=, the teaching pattern in pasted text, or learning mode) → story-expand uses its ABC teaching branch (full A-Z, no villain). ALSO editable narration <textarea> on Voices tab (paste/edit + Generate; button enables on narrationText OR textContent). VERIFIED LIVE.
- #142 scene-plan doer/receiver rule (#8 attempt): "X handcuffs Y" scenes now describe the RECEIVER's state. NEEDS Henry to confirm on a regen.
- #143 COST FIX: all planner image defaults → segmind_pruna (off FAL); PuLID face-lock + img2img now OPT-IN (body.faceLock/identityLock), default OFF. Verified single-char scene stays on Segmind.
- #144 voice labels plain English (no ♀♂·—👶) + selected voice shows ENGINE badge: Edge (free)/Piper (free)/ElevenLabs (paid)/FAL voice (paid).

## 2. COST FACTS (image/video model $/gen)
- Images: segmind_pruna $0.005, segmind_flux $0.0004, fal_flux_schnell $0.003 (FAL), fal_flux_dev $0.025 (FAL), fal_flux_pulid $0.05 (FAL face-lock).
- Video: segmind_pruna_video $0.005, muapi_seedance_lite $0.020, fal_wan_lite $0.025/5s (FAL — Henry says KEEP for children-video), wan_2_5_lite/seedance_v2 $0.08.
- TTS narration: Edge + Piper = FREE. Music: CC0 library = FREE. So spend = images + video clips + small LLM.
- FAL is now only hit by: VIDEO (children-video fal_wan_lite, free-mode wan_2_5_lite), AI music (if funded), Segmind→FAL safety fallback, explicit face-lock / paid voices. Routine images = Segmind (off FAL).

## 3. CAPACITY / LAUNCH (answered Henry)
- Server (Contabo, shared with octogent/other): 8 cores, 23GB RAM, 300GB free disk.
- Bottleneck = video assembly (in-process FFmpeg). ~3-5 concurrent renders; ~2 min for a 5-min video (verified jobs: 112s, 147s).
- ALPHA OK NOW: ~20-50 users, ~5 concurrent renders.
- 2000 students HEAVY = NOT supported on current box. Needs: render queue + worker pool (the #1 thing), object storage (R2), clustered web, managed Postgres + tenant_id/RLS, per-student credit/quota.
- 2000-user/month cost: infra ~$350-750/mo; AI APIs the dominant variable ~$2k (light) / ~$5k (moderate) / ~$16-26k (heavy). Servers cheap, APIs dominate. MUST add per-student credit cap to control it. Per-video API cost ≈ $0.15-0.40.

## 4. SECRETS set this session (server .env only, NOT git)
- JAMENDO_CLIENT_ID + JAMENDO_CLIENT_SECRET — stored but PARKED (Jamendo=CC-BY, unused).
- PIXABAY_API_KEY — stored. BUT Pixabay has NO music API (images/video only) → cannot auto-download Pixabay music.
- Henry's Jamendo account password was pasted in chat — NOT stored (not needed). Pre-launch phase.

## 5. OPEN / NEXT (nothing parked)
- #5 Fund FAL — BLOCKED on Henry. ONLY needed for AI music, which is OPTIONAL (library + uploads cover it). Henry leaning: don't fund.
- #8 Mara/Cobra subject/object swap — attempt shipped (#142); Henry to regenerate the handcuff/tackle scene + confirm. If still swapping → per-scene doer/receiver fields or 2-image composite.
- #14 — move ABC flashcard BUILDER UI onto /dashboard/children-video (concept already there as "Image Alphabet A-Z") + "search online / add more topics / be creative" generator. PENDING.
- Assembly worker detached-process resilience (survive systemctl restart so deploys can't kill renders) — OFFERED, Henry's call, deferred.
- children-video VIDEO still on fal_wan_lite (FAL) — Henry said KEEP. free-mode video wan_2_5_lite still FAL.
- Legacy storage/scenes/unlinked/ pile (incl Henry's ~80 ABC images) — left in place (no data loss); per-project migration deferred (risky).
- 2000-user launch build (render queue/workers + object storage + per-student credits) — Henry interested; spec on request.
- Segmind→FAL auto fallback — could change to a cheaper Segmind fallback so FAL is NEVER auto-hit (Henry's call).

## 6. Brain topics written this session (app=ghs)
sound-licensing, music-copyright-incident, music-rf-sources, children-abc-builder, scene-image-lean,
assembly-narration-timing, music-library-licensing, children-music, children-video-topics,
children-image-isolation, image-isolation-allplanners, music-upload-licensing, children-teaching-expand,
scene-doer-receiver, cost-fal-image-drain, voice-labels-engine, infra-cloudflare, assembly-restart-collision.
