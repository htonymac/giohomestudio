# GHS Planner Workshop — Master Canvas

This document defines the **Planner layer** for GioHomeStudio (GHS).

It is the operational workshop where the user can:

- see all created scenes
- see all drafts and progress
- move into Character or Editor work
- return back to Planner without losing context
- continue from where work stopped
- monitor project readiness
- inspect online intelligence and trend signals
- control assembly from one central place

This is not a small helper page.

This is the **production workshop and command center** for GHS Hybrid Mode and future GHS creation systems.

It must work with the existing GHS laws already established in the Hybrid, Character, Scene, Identity, Audio, and Assembly documents.

The Planner must **not replace** those laws.
It must **orchestrate them**.

---

# 1. Core Product Position

## Planner Meaning

**GHS Planner = the user’s production workshop**

The Planner is the place where structured production work is visible and controllable.

It must sit above raw generation and above isolated editing.

The Planner is where the user understands:

- what has been created
- what is still draft
- what needs review
- what is missing
- what can be edited
- what is ready for assembly
- what is trending or relevant online
- where to go next

The Planner must feel like a real workshop, not a dead dashboard.

---

# 2. Relationship to Existing GHS Laws

The Planner must obey and expose the existing GHS source-of-truth rules:

- Characters are structured identity objects, not just text names
- Stories must become scene objects
- Draft first, assembly later
- Scene and shot control must persist
- Narration must change by scene type
- Audio is structural glue
- Character, voice, scene, and shot IDs must remain stable
- Selective regeneration must be supported
- Assembly happens only when the user explicitly triggers it

The Planner is therefore a **control surface for source-of-truth objects**.
It must never degrade the workflow into random prompt history.

---

# 3. Planner as the Main Workshop Layer

The Planner must become the central workspace connecting:

- Story / Draft Area
- Scene Board
- Character Section
- Editor Section
- Review / Validation Section
- Assembly Section
- Trend / Online Intelligence Section
- Resume / Progress Section

The Planner must always answer these production questions:

1. What project am I working on?
2. What stage is it in?
3. Which scenes are done, draft, blocked, or approved?
4. Which characters already exist?
5. What needs generation next?
6. What needs editing next?
7. What is ready to assemble?
8. What online intelligence may improve this project?
9. Where did I stop last time?
10. How do I jump into Character or Editor and come back safely?

---

# 4. Core Planner Screens and Panels

## A. Planner Home / Project Workshop

This is the main overview page for a selected project.

It must show:

- project title
- project type
- project status
- current phase
- last action taken
- last modified date
- progress summary
- total scenes
- draft scenes
- approved scenes
- blocked scenes
- scenes missing assets
- characters created
- voices mapped
- estimated cost state
- estimated duration state
- readiness for assembly

This page should feel like the user’s production table.

---

## B. Scene Board

This is where all created scenes are visible.

Each scene card must show at minimum:

- Scene ID
- scene title
- order number
- scene type
- draft / review / approved state
- characters present
- motion need
- narration intensity
- planned media route
- preview thumbnail or still
- duration estimate
- cost estimate
- missing asset warning if any
- direct action buttons

Required scene actions:

- open scene
- edit scene
- open in editor
- regenerate scene
- regenerate shot
- change scene type
- adjust narration
- adjust audio plan
- reorder scene
- approve scene
- send back to draft

The Scene Board must support both grid view and timeline/list view.

---

## C. Draft Zone

The Planner must have a dedicated area for all draft work.

This should include:

- story draft
- scene drafts
- shot drafts
- narration drafts
- dialogue drafts
- audio drafts
- visual draft previews
- assembly draft state

This is essential because GHS must remain **draft-first** until the user approves assembly.

The Draft Zone should make unfinished work visible rather than hiding it.

---

## D. Character Section Link Panel

The Planner must provide direct access to Character work.

The user should be able to:

- open character registry
- create new character
- update character identity
- view character assets
- review character continuity state
- fix missing character references
- open voice mapping for a character

The Planner should display character readiness summaries such as:

- character complete
- missing portrait
- missing full body reference
- missing expression set
- missing voice
- continuity warning

---

## E. Editor Section Link Panel

The Planner must provide direct access to the Editor.

The user should be able to:

- jump from Planner to Editor for a scene
- jump from Planner to Editor for a shot
- jump from Planner to Editor for a full assembly draft
- see which scene is currently open in Editor
- see whether editor changes are unsaved, saved, or published back to Planner

The Planner must not treat the Editor as separate chaos.
It must treat the Editor as a connected production tool.

---

## F. Online Intelligence / Trend Panel

The Planner must include an online intelligence section.

This section helps the user understand external relevance such as:

- most viral angles
- most attended-to topics
- rising content patterns
- audience attention patterns
- market mood
- language trend suggestions
- culture and region signals
- content hook suggestions
- competitor style observations where allowed

This panel should not randomly control production.
It should advise the user and support planning.

The Planner should show:

- latest insights summary
- why the insight matters
- recommended impact on project
- suggested scene or hook updates
- suggested title or intro changes
- suggested thumbnail or opening pattern ideas

This makes the Planner a smart workshop, not just a storage room.

---

## G. Resume / Continue Panel

The Planner must support resuming from where the user stopped.

It should show:

- last visited section
- last edited scene
- last edited character
- last open editor task
- last validation warning
- last incomplete step
- next recommended action

Example:

- “You stopped at Scene 08 shot planning.”
- “Character CH03 still needs a voice.”
- “Assembly is blocked by 2 continuity errors.”
- “Editor changes for Scene 05 are ready to push back to Planner.”

This is essential to make the Planner feel like a real workshop session that can be reopened safely.

---

# 5. Navigation and Return-Flow Law

The Planner must support controlled movement between sections.

## Required Navigation Paths

- Planner → Character Section
- Planner → Editor Section
- Character Section → Planner
- Editor Section → Planner
- Planner → Review / Validation
- Planner → Assembly
- Planner → Trend / Online Intelligence

## Return-Flow Rule

Whenever the user leaves Planner for Character or Editor, the system must preserve:

- originating project
- originating scene
- originating shot if relevant
- last task context
- pending warnings
- unsaved draft state
- selected filters or board position

When the user returns, Planner must restore context cleanly.

Required return patterns:

- “Back to Planner”
- “Return to Scene Board”
- “Return to Character Task”
- “Return to Assembly Review”

No user should feel lost after moving between sections.

---

# 6. Planner and Character Section Integration

The Planner and Character Section must behave as one production loop.

## Character Integration Rules

From Planner, the user must be able to:

- inspect all characters used in a project
- see which scenes use each character
- see missing identity fields
- see missing assets
- see voice readiness
- fix character continuity problems before assembly

The Character Section must send structured updates back to Planner such as:

- character created
- character updated
- reference set approved
- voice assigned
- continuity conflict detected
- scenes affected by character changes

Planner must refresh accordingly.

Example:

If CH02 wardrobe changes, Planner should know which scenes may need review.

---

# 7. Planner and Editor Section Integration

The current and future Editor must align with the Hybrid workflow law.

That means the Editor is **not** the first place where characters are invented or where scene identity is guessed from scratch.

The correct alignment is:

- story text creates structured scene intent
- character objects already exist or are created through Character tools
- scene objects already exist in Planner
- scene image generation uses those stored objects
- Editor works on refinement, correction, collaboration, and controlled updates

So the Editor must sit **inside** the workflow, not outside it.

## Core Alignment Rule

The workflow signified by GHS should behave like this:

Story / Script Text
↓
Character Extraction / Character Creation
↓
Character Image / Character Registry
↓
Scene Object Creation
↓
Scene Image Generation
↓
Scene Review
↓
Collaborative Editing / Refinement in Editor
↓
Return to Planner
↓
Approval / Assembly Readiness

This means the Editor must support the workflow, but must not bypass source-of-truth planning.

---

## Planner-First Creation Buttons

The Planner must expose direct action buttons so the user can move through this workflow naturally.

Required buttons include:

- Create Character
- Open Character Registry
- Insert Existing Character
- Create Scene
- Make Scene Image
- Open Scene in Editor
- Return to Planner
- Approve Scene Draft

These actions should appear in the right context.

Example:

On a scene card in Planner, the user should see:

- Edit Scene Text
- Add / Insert Characters
- Make Scene Image
- Open in Collaborator Editor
- Regenerate Scene Image
- Approve for Next Step

---

## Planner to Character Flow

If the user is working on story text and a required character does not yet exist, the Planner must allow:

- click Create Character
- open Character Section with project context preserved
- create the character identity object
- create or confirm character visual references
- assign or confirm Character ID
- return to Planner automatically with the new character available

This is critical.

The user should not need to leave the workflow mentally or manually copy identity details around.

---

## Make Scene Image Entry Point

The user specifically needs scene image generation to be available directly from Planner and from collaborative editing.

That should become a formal rule.

### Allowed Entry Points

A scene image may be generated from:

- Planner Scene Board
- Scene Detail page inside Planner
- Collaborative Editor / Collab Edit area

### Not Allowed

Scene image generation should not act like a random blank prompt box disconnected from the project state.

It must always know:

- which project is active
- which scene is active
- which characters belong to the scene
- which Character IDs are selected
- which scene text version is current
- whether the result is a new draft or regeneration

---

## Scene Image Generation Workflow

When the user clicks **Make Scene Image** in Planner or Editor, the system should open a structured scene-image panel.

That panel must contain:

- active Scene ID
- scene title
- scene text
- scene description box editable by the user
- list of available characters for that project
- selected scene characters
- Character ID chips / buttons
- insert-character controls
- scene mood
- location
- time of day
- style or visual direction if applicable
- generate button
- save as draft button

This panel should not force the user to retype everything from zero.

---

## Character Input UX for Scene Image Creation

The user’s idea here is correct and should be formalized.

The system should make character insertion easy through buttons, chips, or selectable identity tokens.

Instead of depending only on typing plain names, the UI should support:

- character picker button
- clickable character chips
- import character from registry
- search by display name
- insert by Character ID token

Example visual tokens:

- JON_UUU
- CH01 JON_UUU
- CH02 ZARA_NG

The better internal truth is that the system uses Character IDs, even if the UI also shows friendly names.

So when the user selects a character, the text box may show a readable token, but the stored scene data should map to the real Character ID object.

---

## Text Awareness Rule

Yes, the text should already know the characters.

That means once a project has character objects and scene objects, the scene text area should already be aware of:

- known characters in the project
- characters already assigned to the current scene
- character names and IDs
- speaking characters where relevant

This allows the user to:

- type scene text naturally
- click buttons to insert a known character
- attach character identity without re-describing the character from scratch
- avoid repeating appearance definitions every time

The text field should therefore be **character-aware**, not dumb plain text.

---

## Example Planner Scene-Image Flow

A correct flow should work like this:

1. User writes or reviews scene text in Planner
2. User clicks Add / Insert Characters
3. Planner shows existing character buttons or chips
4. User selects JON_UUU and another character if needed
5. Planner attaches the real Character IDs to the scene
6. User adjusts scene wording or visual prompt text
7. User clicks Make Scene Image
8. GHS generates the scene image using:
   - scene text
   - selected character identities
   - known character references
   - scene mood and location data
9. Generated image returns as a draft asset for that scene
10. User can approve it or open it in Editor / Collab Edit for refinement

This is the workflow that must exist.

---

## Editor Role in This Flow

The Editor must work in alignment with this system.

That means the Editor can:

- refine scene text
- refine visual wording
- replace or add a scene character
- regenerate a scene image
- crop / frame / trim the visual result where applicable
- mark a scene image as approved
- send the result back to Planner

But the Editor should not break the project’s source-of-truth identity mapping.

If the user changes characters inside the Editor, the change must sync back to Planner as structured data.

---

## Collab Editor Rule

In collaborative editing mode, the user should also be able to click **Make Scene Image**.

But the same law still applies:

- it must use the active scene object
- it must use the project character registry
- it must use stored Character IDs
- it must save back into the same scene draft state

So Collab Edit is an additional entry point, not a separate uncontrolled generation universe.

---

## Required Return Behavior

After scene image generation from Planner or Editor, the system must support:

- Save and Stay
- Save and Return to Planner
- Send to Editor
- Mark as Draft
- Approve Scene Image
- Regenerate with Same Characters
- Regenerate with Edited Scene Text

This return behavior is necessary to preserve the workshop flow.

---

## Final Alignment Law

The correct alignment is:

Planner = workshop control center
Character Section = identity creation and management
Scene Image Generation = structured project-aware creation step
Editor / Collab Edit = refinement and controlled iteration

So yes — this flow belongs in the Planner canvas and should be treated as part of the master workshop design.

# 8. Planner AI Authority Model

The Planner should support more than one intelligence layer, but authority must stay clear.

## Layer A — Local Assistant by Default for Low-Risk Planner Tasks

A local model may help with low-risk support work such as:

- UI summaries
- basic planner status updates
- session recap
- lightweight sorting or grouping help
- non-authoritative suggestion formatting
- low-risk trend note presentation
- simple online findings summaries after retrieval

This local helper is not allowed to become the final authority for core production logic.

## Layer B — Intelligent Cloud Planning Authority

Core production intelligence must be handled by strong intelligent AI.

This includes:

- story planning
- character design logic
- scene breakdown
- hybrid routing
- narration strategy
- continuity reasoning
- assembly validation
- dialogue ownership logic
- scene priority decisions
- creative upgrade recommendations

## Layer C — GHS Pro Model Assignment

If the user is on **GHS Pro**, the Planner may let the user assign premium reasoning engines such as GPT or Claude for advanced planning work.

This Pro layer can be used for:

- higher-quality scene reasoning
- stronger continuity review
- advanced narrative repair
- stronger commercial angle planning
- better trend interpretation
- deeper assembly advice

## Authority Law

Even if a local helper exists, it must not override the source-of-truth rules.

Local helper = assistant support.
Intelligent cloud planner = authoritative production reasoning.
GHS Pro = premium reasoning upgrade.

---

# 9. What the Planner Must Track as Persistent State

The Planner is not just visual UI.
It must sit on persistent production state.

## Required Persistent Project Objects

- Project ID
- Project Type
- Story Draft ID
- Character IDs
- Voice IDs
- Scene IDs
- Shot IDs
- Asset IDs
- Timeline Draft ID
- Validation Report ID
- Trend Insight Snapshot ID
- Resume Checkpoint ID

## Required Planner Status Fields

- current phase
- progress percentage
- last completed task
- next recommended task
- blocking issues count
- missing assets count
- continuity warnings count
- draft scenes count
- approved scenes count
- editor return pending count
- assembly readiness state

This persistence is what makes the workshop reliable.

---

# 10. Planner Workflow End-to-End

The Planner should orchestrate this complete workflow:

User creates or opens project
↓
Planner loads last checkpoint
↓
Story draft appears
↓
Characters are visible and linked
↓
Scenes are visible in board form
↓
Missing items are flagged
↓
User opens Character Section or Editor where needed
↓
Changes return to Planner
↓
Planner updates project progress
↓
Online intelligence may suggest better angle, title, intro, or scene emphasis
↓
Validation checks run
↓
User reviews readiness
↓
User explicitly triggers assembly
↓
Assembly draft returns to Planner / finishing flow
↓
User approves export path

The Planner should always be the workshop the user returns to.

---

# 11. Required Planner Views

The Planner should offer multiple views for the same project state.

## A. Overview View
High-level workshop status.

## B. Scene Board View
Scene cards and progress state.

## C. Timeline Readiness View
What is ready, blocked, missing, or approved.

## D. Character Readiness View
Identity, asset, and voice health.

## E. Draft View
All unfinished work grouped together.

## F. Trend / Insight View
Online opportunity and attention signals.

## G. Resume View
Continue where the user stopped.

These views should all read the same source-of-truth objects.

---

# 12. Online Progress and Insight System

The user asked for the ability to see online progress and what is most attended to.
This should become a formal planner feature.

## Purpose

Help the user understand how to improve project relevance without turning GHS into trend chaos.

## Planner Insight Categories

- most viral content angle
- strongest opening hook type
- current audience attention direction
- trend-worthy topic patterns
- strong title framing ideas
- culture or region adaptation hints
- preferred intro pacing direction
- attention drop risks
- suggested call-to-action pattern for commercial work

## Usage Rules

This panel should:

- advise, not auto-rewrite everything
- link suggestions to project goals
- show why a trend matters
- show which scenes or intro may benefit
- let the user accept, ignore, or save suggestions

## Output Examples

- “Your opening is too slow for current short-form attention style.”
- “This topic is receiving stronger attention when framed as a warning or reveal.”
- “Scene 01 may need a more visual hook before narration starts.”
- “Audience attention is stronger when the lead character appears within the first beat.”

---

# 13. Resume-from-Where-You-Stopped Doctrine

The Planner must behave like a workshop that never forgets the user’s working position.

## Required Resume Memory

- last open project
- last active tab
- last active board position
- last edited scene
- last edited shot
- last opened character
- last editor session status
- last unresolved warning
- last generated preview set
- last trend insight snapshot

## Resume Entry Modes

- Resume last session
- Resume project from draft checkpoint
- Resume from editor return
- Resume validation review
- Resume assembly preparation

This is critical for long-form GHS work.

---

# 14. Planner Progress System

The Planner must translate complex work into understandable progress.

## Progress Dimensions

- story progress
- character progress
- scene progress
- shot planning progress
- voice mapping progress
- audio plan progress
- visual draft progress
- validation progress
- assembly readiness progress
- export readiness progress

Progress must not be fake.
It should reflect actual structured completion.

Example:

- Story: 100%
- Characters: 75%
- Scenes: 82%
- Audio Planning: 61%
- Assembly Readiness: 43%

This helps the user know what really remains.

---

# 15. Planner Warnings and Blockers

The Planner must surface real blockers clearly.

## Common Planner Warnings

- character missing identity fields
- missing voice assignment
- missing scene still
- unresolved continuity issue
- editor change not pushed back
- scene missing audio plan
- dialogue line missing owner
- validation failed
- assembly blocked
- export blocked

## Blocker Design Rule

Warnings should not be buried.
They must be visible at workshop level and linked to the fix path.

Example:

“Scene 06 blocked: voice owner missing for dialogue line 3.”
“Assembly blocked: CH04 reference mismatch across 2 scenes.”

---

# 16. Planner-Based Validation Gateway

The Planner must be the place where validation becomes understandable.

Before assembly, Planner should show:

- continuity pass / fail
- voice mapping pass / fail
- missing assets pass / fail
- scene order pass / fail
- dialogue ownership pass / fail
- timing readiness pass / fail
- editor sync pass / fail

The user should be able to click each issue and go directly to the right fix area.

Examples:

- go to Character Section
- go to Scene Board
- go to Editor
- go to Audio Plan
- go to Validation Detail

---

# 17. Assembly Control from Planner

The Planner must control assembly, not hide it.

## Assembly Rule

Assembly only begins when the user explicitly triggers it.

Planner must provide a clear action such as:

- Assemble My Scenes
- Assemble Draft Timeline
- Build Preview Timeline

## Before Assembly

Planner should display:

- readiness summary
- warning count
- cost estimate
- duration estimate
- scene mix summary
- audio readiness
- character continuity readiness

## After Assembly

Planner should display:

- timeline draft created
- editor-ready timeline
- unresolved fixes
- preview available
- final approval status

---

# 18. Planner UX Personality

The Planner should feel:

- active
- informative
- professional
- workshop-like
- production-aware
- progress-aware
- not overly technical for the user
- but structurally rigorous underneath

It should feel closer to a smart studio workshop than a flat admin page.

---

# 19. Claude Code Implementation Rules for Planner

Claude Code must implement the Planner as a real production control layer.

## Claude Code Must Preserve

- project persistence
- source-of-truth IDs
- draft-first state
- cross-section navigation with safe return
- Character ↔ Planner loop
- Editor ↔ Planner loop
- progress tracking based on real objects
- validation visibility
- assembly trigger control
- online intelligence as advisory support
- resume-from-checkpoint behavior

## Claude Code Must Not Do

- treat Planner as a static dashboard only
- lose context when the user enters Character or Editor
- auto-assemble without approval
- let local helper replace core planning authority
- hide blockers from the user
- break source-of-truth identity objects
- treat scene progress as fake percentages disconnected from state

---

# 20. Recommended Internal Planner Modules

A practical module breakdown may include:

- Planner Project Shell
- Project Overview Panel
- Scene Board Module
- Draft State Module
- Character Link Module
- Editor Link Module
- Resume Checkpoint Module
- Trend Insight Module
- Progress Engine
- Warning / Blocker Engine
- Validation Gateway
- Assembly Launcher
- Return Context Manager

These modules should share one production state graph.

---

# 21. Practical Example of Planner Movement

Example user flow:

1. User opens a hybrid project in Planner
2. Planner shows 12 scenes, 8 draft, 2 approved, 2 blocked
3. Planner warns that CH02 is missing a final voice map
4. User clicks Character Section from Planner
5. User fixes CH02 voice
6. User clicks Back to Planner
7. Planner refreshes and removes the voice blocker
8. User opens Scene 05 in Editor
9. User trims the shot and updates subtitle timing
10. User clicks Publish Back to Planner
11. Planner updates Scene 05 status to “edited, validation needed”
12. User reviews trend panel and sees a stronger opening hook suggestion
13. User updates Scene 01 intro approach
14. Planner runs validation
15. User triggers Assemble My Scenes
16. Planner moves project into assembly draft state

This is the workshop behavior required.

---

# 22. Final Product Position

GHS Planner is not just a planning page.

It is the **workshop brain and production navigation layer** for GHS.

It must let the user:

- see the whole project
- move between planning and execution
- return safely from each tool section
- understand draft progress
- understand blockers
- use intelligent help
- inspect online attention signals
- resume from where work stopped
- assemble only when ready

If built correctly, the Planner becomes one of the strongest product-defining parts of GHS because it turns scattered AI generation into a controllable studio workflow.

---

# 23. Final Law

Claude Code must treat the Planner as a **persistent workshop control layer** across Hybrid, Character, Scene, Audio, Editor, Validation, and Assembly.

The Planner must always preserve:

- project continuity
- user context
- movement between sections
- source-of-truth identity control
- draft-first workflow
- intelligent guidance
- explicit assembly control
- resume reliability

This is the master canvas law for the GHS Planner Workshop.

