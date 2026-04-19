# GHS Support Canvas — Video Finishing, Legal Safeguards, Sound Licensing, Narration, and Assembly

We are continuing GioHomeStudio from an already-working localhost build.

This is a support canvas for Henry and Claude Code.

This document is meant to support the master canvas, not replace it.

The goal here is to gather the practical implementation support points that came out of the discussion and align them into one additional working canvas for Claude Code.

This support canvas should stay consistent with the master direction:

- protect GHS properly
- keep product workflows practical
- make imported-video finishing a serious feature
- keep licensing and attribution disciplined
- make narration part of the assembly plan
- keep AI planning separate from deterministic execution
- avoid weak architecture such as random LLM-to-raw-FFmpeg output

This document should be read as a companion implementation guide.

---

## 1. Support Position

GHS should be powerful, but not careless.

The main support principle from the discussion is this:

GHS must not rely on only one weak defense such as:

- we do not post it
- we do not store it forever
- it stayed on the user device first

Those things help, but they do not remove all risk.

The stronger practical position is:

- reduce retention
- prefer local/on-device-first where practical
- upload intentionally, not automatically
- require approval before important upload or export steps
- require rights confirmation for risky use cases
- block obviously deceptive or unsafe uses
- track sound source and license information
- make attribution a system feature
- log important approvals and assembly decisions
- keep final export review-first

That is the real product-defense direction.

---

## 2. Why This Support Canvas Exists

The discussion revealed that the imported-video finishing workflow is important enough to stand clearly on its own.

This is not only:

- AI Content Creator
- Ad Creator
- Music Video Creator
- Movie Creator

It is its own practical enhancement workflow where a user already has media and wants GHS to improve it intelligently.

The support role of this canvas is to make sure Claude Code builds this as:

- a real structured workflow
- a safe media handling workflow
- a license-aware sound workflow
- a narration-aware assembly workflow
- a model-tier-aware planning workflow
- a deterministic FFmpeg execution workflow

---

## 3. Clarification on Legal Exposure

A person or company may still try to bring a complaint against GHS even if GHS is not the one publicly posting content.

The likely claim would not usually be:

> GHS stored my image forever.

It would more likely be framed as:

- GHS enabled or facilitated misuse
- GHS processed or transformed likeness/voice without proper safeguards
- GHS helped create a misleading or harmful output
- GHS failed to block an obviously risky or unauthorized use
- GHS packaged, exported, or assisted the creation of infringing material
- GHS product design encouraged misuse without adequate controls

That does not automatically mean GHS would lose.

It means the safer approach is to build product controls early rather than depending only on legal wording later.

---

## 4. Product Controls Must Come Before Fancy Automation

Claude Code should treat protection features as foundational product architecture.

Before spending effort on deeper automation, GHS should have a usable base for:

- rights confirmation
- risky-use warning flows
- sound license metadata
- attribution generation
- approval gating
- audit logging
- review-first export

This should not be postponed as a future “compliance layer.”

It should be part of the product core.

---

## 5. Imported Video Finishing Must Use One Shared Engine

The feature may appear in different parts of GHS such as:

- Video tools
- Music tools
- Content area

But Claude Code should not build separate messy pipelines behind each entry point.

There should be one shared underlying engine for:

- imported video analysis
- narration planning
- music planning
- SFX planning
- subtitle/overlay timing
- assembly planning
- review and approval
- FFmpeg execution
- export

This means the visible entry point can differ, but the internal finishing pipeline should remain shared.

---

## 6. Clean Product Definition for Video Finishing Studio

The practical support definition is:

GHS Video Finishing Studio allows a user to import an existing video and intelligently enhance it with narration, background music, sound effects, ambience, subtitles, overlays, and optional company/promo elements, then review the result before deterministic assembly and export.

Core mental model:

import video -> analyze -> plan layers -> review -> approve -> assemble -> export

This is the core experience.

---

## 7. Audio Must Be Planned as Separate Layers

For imported video enhancement, Claude Code should think in distinct audio layers.

The planner should treat these as separate controllable layers:

1. original video audio
2. narration voice
3. background music
4. sound effects
5. ambience / atmosphere

The system should not just pile them together.

The planner must decide:

- whether original audio stays fully, partially, or mostly lowered
- where narration starts and pauses
- where music enters and exits
- where music ducks under speech
- where SFX land for emphasis
- where ambience supports mood quietly
- when silence should be respected instead of overfilled

This is what makes finishing feel professional rather than noisy.

---

## 8. Narration Must Be Treated as a First-Class Planning System

Narration should not be a final add-on after assembly logic is already decided.

Narration must be planned with:

- language
- voice choice
- speed
- tone
- pacing
- emphasis
- start points
- stop points
- pause points
- interaction with music
- interaction with SFX
- subtitle alignment where needed

Narration support should include:

- user language
- available installed languages
- standard AI voices
- approved user voice workflows where allowed
- educational narration
- commercial narration
- story narration
- explainer narration

Important support rule:

Narration decisions must be visible during review before final rendering.

---

## 9. Assembly Must Be Structured, Not Improvised

The discussion made this very clear:

AI should plan.
FFmpeg should execute.

Claude Code must not let the system degrade into:

random prompt -> random raw ffmpeg output -> unstable result

The correct support architecture is:

1. planner model produces a structured assembly plan
2. supervisor model checks timing and consistency
3. assembly JSON becomes source of truth
4. FFmpeg builder converts the JSON into deterministic commands
5. preview render checks sync and quality
6. final render runs only after approval

This is a core architecture requirement.

---

## 10. Assembly JSON Should Be the Source of Truth

Claude Code should build a stable assembly schema.

The assembly data structure should be able to express at least:

- video segments
- imported still image segments if inserted
- narration in/out timings
- music in/out timings
- SFX placements
- ambience layers
- subtitle timings
- text overlay timings
- logo placement timings
- fade-in / fade-out points
- transitions
- volume automation
- ducking rules
- export targets
- aspect ratio variants

This JSON should remain stable even when the planning model tier changes.

That is how GHS gets both intelligence and consistency.

---

## 11. Model Tiers Must Affect Planning Quality, Not Execution Stability

The discussion also made this important point:

local LLM must not become the hidden default for all assembly intelligence.

Claude Code should support these internal product tiers:

### GHS Standard

Local-first / lowest-cost planning tier.

Use for:

- rough director help
- rough supervisor help
- first-pass planning
- basic metadata
- lightweight suggestions

### GHS Pro

Stronger hosted-model planning tier.

Use for:

- better structured planning
- better narration timing
- better sound placement
- better timeline suggestions

### GHS Premium

High-quality planning tier.

Use for:

- stronger creative judgment
- better continuity
- better assembly planning
- stronger timing quality

### GHS Premium Best

Top-end reasoning and supervision tier.

Use for:

- hardest planning tasks
- best supervision passes
- difficult continuity checks
- premium assembly reasoning

Support rule:

The planner and supervisor may vary by tier, but the FFmpeg execution layer must stay deterministic.

That means:

- same assembly JSON contract
- same builder behavior
- same approval logic
- same logging behavior

Only planning quality changes. Execution should remain controlled.

---

## 12. Local LLM Should Be Useful, But Not Overtrusted

The discussion did not reject local models.

It clarified their role.

Local models are useful for:

- low-cost assistance
- first-pass planning
- cheap rough suggestions
- helper drafting
- local-first privacy-friendly draft support

But Claude Code should not let local models silently become the default brain for all assembly-critical work.

Better rule:

- Standard may use local heavily
- Pro, Premium, and Premium Best must be able to route to stronger hosted planners and supervisors
- critical timing and structured output quality should improve with tier, not become random

---

## 13. Rights Confirmation Must Appear at the Point of Risk

The rights layer should not live only in Settings.

For risky actions, Claude Code should surface confirmation where the action happens.

Examples of workflows that should trigger stronger rights confirmation:

- using someone else’s likeness in commercial/promo content
- cloning or synthesizing a third-party voice
- building endorsement-style content
- transforming imported third-party media in a potentially misleading way
- using content that appears to belong to someone else

Suggested confirmations include:

- I own this content or have permission to use it
- I have permission to use this likeness or face
- I have permission to use or synthesize this voice if relevant
- I have commercial rights if this is an ad or business use
- I understand unauthorized use may violate law or platform rules
- I accept responsibility for rights I do not own

This should be a real interaction step, not buried legal text.

---

## 14. Risky Use Cases Should Trigger Harder Controls

These should not be treated like normal editing:

- celebrity cloning
- third-party voice cloning without permission
- fake endorsements
- “make this person say this” deception workflows
- intimate or exploitative manipulations
- deceptive political or public-interest misuse
- child-risk content

Support rule:

These workflows should trigger one or more of:

- stronger warnings
- rights confirmation
- stricter review
- possible blocking
- audit logs

---

## 15. Review-First Is a Core Defense and UX Rule

The review step should not be optional in risky or costful workflows.

Before final export, the user should be able to review:

- imported video used
- audio layers used
- narration plan
- selected voice/language
- music choice
- sound effects choice
- subtitles/overlays
- relevant sound licenses
- attribution output where needed
- model tier used
- export settings
- estimated cost where relevant

The user should be able to:

- approve
- revise
- swap sounds
- remove narration
- change voice
- re-preview
- adjust export choices

No final export should happen before approval.

---

## 16. Audit Logging Should Capture the Important Story

Claude Code should not overlog everything blindly, but it must log key trust and assembly events.

Useful log items include:

- source type
- whether media stayed local or was uploaded
- upload approval timestamp
- export approval timestamp
- risky-action confirmation state
- rights-confirmation version accepted
- sound assets used
- sound license type used
- attribution text generated
- planner tier used
- supervisor tier used
- provider used
- assembly JSON version
- preview status
- final render status

This supports:

- debugging
- support
- accountability
- future dispute handling
- future trust/safety tooling

---

## 17. Sound Policy Must Stay Strict and Simple

The discussion strongly supports a three-bucket rule for normal production sound use.

Claude Code should build around only these three normal buckets:

### Bucket 1 — Fully Owned / Custom-Created Sounds

Examples:

- GHS-owned sounds
- internally created sounds
- approved workflow-created sounds
- user-owned uploaded sounds

### Bucket 2 — CC0 Sounds

Safer for reuse where the source is properly tracked.

### Bucket 3 — CC BY Sounds With Automatic Attribution Support

Allowed only when attribution is properly handled by the system.

Important restriction:

Do not allow unknown-license sounds into normal production.

Strong restriction:

Do not let CC BY-NC enter normal commercial production flows.

---

## 18. Attribution Must Be a Feature, Not a Note

Claude Code should build attribution as a structured system feature.

Every relevant imported sound record should store at least:

- asset ID
- source platform
- source URL
- title
- creator name
- license type
- attribution required flag
- commercial allowed flag
- attribution text
- local file name or storage key
- eligibility status

For CC BY usage, GHS should automatically generate:

- a project sound credits block
- copyable attribution text
- optional export metadata credits
- optional end-card credits when relevant
- optional description-ready credits text

Useful UX items include:

- Copy Credits button
- Show Attribution button
- Include Credits in Export option where appropriate

This must not depend on the user remembering attribution manually.

---

## 19. Sound Vault Must Be Expanded Heavily

The discussion made it clear that a tiny sound set is not enough.

Claude Code should build a much larger organized internal sound vault.

High-priority categories include:

- piano hits
- soft piano beds
- whooshes
- risers
- impacts
- wind
- rain
- thunder
- footsteps
- crowd ambience
- market ambience
- city ambience
- village ambience
- office room tone
- keyboard and typing
- cloth movement
- paper movement
- water splash
- kitchen sounds
- doors
- vehicle pass-bys
- school ambience
- classroom ambience
- educational playful sounds
- children learning support sounds

Support rule:

Do not use live generation as the default source for ordinary sounds that can be safely preloaded and reused.

---

## 20. Sound Source Decision Tree

Claude Code should implement a clean source-order resolver.

Preferred order:

1. user-owned/custom uploaded sound
2. GHS vetted local sound vault
3. approved CC0 source
4. approved CC BY source with attribution support
5. custom generation provider when needed
6. review fallback when confidence is low

This order helps reduce:

- cost
- latency
- repeated provider calls
- licensing confusion
- unstable production quality

---

## 21. “Free” Must Never Be Treated as Automatically Safe

The discussion raised this clearly.

Claude Code should never treat:

- free to download
- free sound
- online sound found somewhere

as meaning automatically safe for commercial use.

GHS should clearly distinguish:

- commercially safe
- attribution required
- noncommercial only
- restricted / not for auto-use
- unknown / blocked from production

This discipline is important.

---

## 22. User Messaging for Sound Ownership Must Stay Careful

GHS should not promise:

- no one can ever challenge this
- you fully own everything regardless of source
- all custom output is automatically risk-free

Safer product direction:

> Custom-generated sound created inside GHS may be used by the customer subject to GHS terms and any applicable third-party provider terms. For imported third-party sounds, the customer is responsible for complying with applicable license, attribution, and usage restrictions. GHS may provide attribution assistance, but the customer remains responsible for lawful final use.

That is a much safer posture.

---

## 23. Company Promo From Static Assets Fits This Workflow Too

This support canvas also confirms that the finishing/assembly engine should support promo-style assembly from:

- logo
- banner text
- product/service text
- company details
- images
- optional imported video

AI can plan:

- sequence
- overlays
- narration script
- timing
- music mood
- CTA structure

Then FFmpeg can execute:

- image sequence assembly
- pan/zoom movement
- overlays
- narration mix
- music mix
- subtitles
- export

This is especially useful for:

- property promos
- service explainers
- founder intros
- product promos
- business recap videos

Important support rule:

Even here, narration, sound-source, license, and review rules still apply.

---

## 24. Suggested Internal Engine Split

Claude Code may think in these internal subsystems:

### 1. Video Analyzer

Reads imported video and extracts useful planning signals such as:

- duration
- audio presence
- silence areas
- likely cuts
- speech-heavy areas
- possible music need points

### 2. Assembly Planner

Plans:

- narration timing
- music timing
- SFX timing
- subtitle timing
- overlay timing

### 3. Audio Balance Planner

Plans:

- narration priority
- music ducking
- ambience support
- SFX emphasis

### 4. Sound Source Resolver

Chooses:

- user sound
- local sound vault
- approved free source
- generation fallback

### 5. FFmpeg Assembly Engine

Executes final deterministic assembly.

This split is cleaner than one giant vague “AI editor.”

---

## 25. Suggested Review Panels

A good review experience may expose panels such as:

1. Import Summary
2. Narration Plan
3. Music Plan
4. Sound Effects Plan
5. Subtitle / Overlay Plan
6. Source / License Summary
7. Assembly Preview
8. Export Settings

Optional later:

- Audio Source Manager
- Credits / Attribution Panel
- Rights Confirmation History
- Model Tier Panel

---

## 26. MVP Direction for This Support Canvas

Recommended MVP includes:

- import existing video
- add narration
- add background music
- add sound effects
- basic subtitle or overlay support
- AI planning layer
- assembly JSON foundation
- FFmpeg execution
- local/vetted sound library priority
- sound metadata basics
- review-first workflow
- export

Keep later:

- advanced publishing automation
- large compliance dashboards
- broad takedown tooling
- huge multi-team review systems
- advanced manual timeline editing

---

## 27. Priority Order for Claude Code

To stay aligned with the master direction, Claude Code should prioritize in this order:

### First — Protection and Metadata Foundation

Build:

- rights confirmation flow
- sound metadata schema
- attribution support
- audit logging
- approval gating
- upload-only-after-approval support

### Second — Sound System Foundation

Build:

- expanded tagged local sound vault
- sound retrieval layer
- source-order resolver
- bucket enforcement
- usage eligibility checks

### Third — Assembly Foundation

Build:

- assembly JSON schema
- deterministic FFmpeg command builder
- preview renderer
- stable export path

### Fourth — AI Planning Layer

Build:

- planner output to assembly JSON
- supervisor validation
- model-tier routing

### Fifth — UX Layer

Build:

- review panels
- attribution visibility
- export approval UI
- model tier selector

This sequencing keeps the system safer and more stable.

---

## 28. Data Structures Worth Considering

Claude Code should think in structured records.

### Sound Asset Record

- asset_id
- title
- creator_name
- source_platform
- source_url
- license_type
- requires_attribution
- commercial_allowed
- attribution_text
- local_filename
- cache_status
- usage_bucket
- tags
- duration
- quality_rating

### Project Sound Usage Record

- project_id
- asset_id
- usage_type
- attribution_included
- commercial_context
- export_eligible

### Rights Confirmation Record

- user_id
- project_id
- confirmation_type
- accepted_version
- timestamp

### Assembly Record

- project_id
- assembly_json_version
- planner_model_tier
- supervisor_model_tier
- preview_status
- render_status

These structures should help keep the pipeline traceable.

---

## 29. Things Claude Code Should Not Do

- do not default all assembly planning to local LLM
- do not treat “free sound” as commercially safe by default
- do not allow unknown-license sounds into normal production
- do not allow CC BY-NC in normal commercial flows
- do not skip attribution metadata storage
- do not let AI freestyle raw FFmpeg blindly end-to-end
- do not upload assets by default where local-first draft flow is practical
- do not allow risky export before review and checks

These are important guardrails.

---

## 30. Main Message to Claude Code

Please build this as a real support architecture aligned to the master canvas.

The main implementation message is:

1. protect GHS through product controls, not just legal text
2. keep imported-video finishing as a serious separate workflow
3. use one shared finishing/assembly engine underneath the different entry points
4. make narration part of planning, not an afterthought
5. make sound sourcing disciplined and metadata-aware
6. enforce the 3-bucket sound policy
7. build attribution as a system feature
8. expand the internal sound vault instead of overusing generation providers for ordinary sounds
9. let AI plan and let FFmpeg execute deterministically
10. keep local LLM useful, but do not let it become the hidden default for all assembly intelligence
11. support GHS Standard / Pro / Premium / Premium Best routing
12. keep final export review-first and approval-based

---

## 31. Final Support Position

This support canvas reinforces the same direction as the master canvas.

GHS should move toward:

- privacy-respecting handling
- local/on-device-first where practical
- upload only after intentional approval
- rights confirmation for risky actions
- strict blocking of deceptive misuse
- strong sound-license discipline
- automatic attribution support
- larger internal sound vault
- narration-aware planning
- AI + FFmpeg structured collaboration
- model-tier-aware planning
- deterministic execution
- review-first export

If Claude Code follows this support canvas together with the master canvas, GHS becomes safer, more disciplined, more scalable, and more professional without losing creative power.

