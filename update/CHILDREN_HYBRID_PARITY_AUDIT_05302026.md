# Children ↔ Hybrid Planner Parity Audit — 2026-05-30

After the 2026-05-30 fix sprint, here's where children-planner stands vs hybrid-planner.

## ✅ Now at parity (closed this session)

| Feature | Hybrid | Children | Closed by |
|---|---|---|---|
| Scene-card edit buttons auto-regen image | yes | yes | `6793682` |
| Template selection → auto-expand on land | yes | yes | `1d571d1` |
| LLM tier + video/image model URL params | yes | yes | `7109fda` |
| Narration auto-generation in assembly | yes | yes | `0b57265` |
| Subtitle config respected in caption | yes (libass) | yes (drawtext+stagger) | `a40b53a` |
| Subtitle modes (8 FB/YT styles + highlight) | yes (libass) | partial — only when migrated | `7894e03` / `27d6c36` (hybrid only) |
| Bear-anti-priming in scene-image | yes | yes (shared route) | `46ae279` |
| Legacy subtitle mode presets (kids/dramatic/social) | yes | yes (shared assembly/execute) | `d32b602` |
| C6 pacing engine save/load | n/a (hybrid different) | yes | `89b62f9` |
| AI Audio Plan panel (Step 7 equivalent) | yes | yes | `e961c8d` |
| Token Resolution Engine in scene-image | yes | yes (shared route) | `4ba3959` |

## 🟠 Remaining parity gaps (NOT closed this session)

### 1. Assembly endpoint divergence — biggest single gap
- **Hybrid:** `POST /api/assembly/execute` — full libass per-sentence subtitle timing, narrator/actor duck coordination, 8 FB/YT subtitle presets, ASS animations.
- **Children:** `POST /api/video/assemble` — drawtext-based caption staging (5-word chunks, fade in/out). Style fields respected. NO per-sentence libass timing, NO duck coordination, NO ASS animation overrides.
- **Why it matters:** even though the subtitleConfig flows in, children users will not see the full bouncing-ball karaoke / rainbow / dance modes that hybrid users see. The current children path only honors fontSize / textColor / bgBox / bgOpacity / position.
- **Migration cost (estimate):** 3-4 h to convert children's `assembleVideo()` payload to AssemblyJSON schema, route through `/api/assembly/execute`, handle the schema differences (segments / narration / music / SFX / subtitleConfig fields), test full e2e.
- **Trigger:** `go children assembly migration` (defer until Henry asks; high-risk single-shot change).

### 2. Establishing Shot UI in children
- Hybrid has `addEstablishingShot(scene)` / `genEstablishingShotImage(sceneId)` / `addAllEstablishingShots()` + UI.
- Children has none. Children scenes don't get cinematic opener clips.
- Migration cost: ~1 h.

### 3. Scene chat / inline AI editing
- Hybrid has `scene-chat` per-scene with provider chooser.
- Children's scene edit ops route through `handleChildSceneOp` (just shipped image-regen fix) but no free-form chat.
- Migration cost: ~1.5 h.

### 4. Pre-flight check
- Hybrid has `aiPrepareAssembly` + `Pre-Flight check` button. Children has equivalent but tied to a separate Generate Narration flow.
- Mostly at parity after this session's auto-narration fix; surface a single "Pre-Flight" entry point if Henry wants the same single-click flow.

### 5. Provider adapters not yet mirrored
- Hybrid scene-edit accepts `provider: "auto" | "ollama" | "openai" | "claude"`.
- Children handler calls scene-edit without a provider → default `"auto"`. Works; same fallback cascade.
- Not strictly a gap. Optional: expose provider dropdown in children scene-card buttons.

## 🟢 Recommendation

Children-planner is at ~85% feature parity with hybrid after this session. The remaining 15% concentrates in (1) the assembly-endpoint migration and (2) the establishing-shot UI. Defer both until Henry explicitly triggers — neither is a regression, just a known divergence with a clear migration path.

Henry can keep using children today; visible quality has clearly improved this session (audio plan / pacing persistence / narration auto-gen / subtitle staging / template auto-fill / button fix / LLM URL threading).
