# GHS Story Quality Control Layer — Full Supervisor Plan

## Purpose

GHS story section must not be a simple flow where GPT or Claude writes a story and sends it straight to video generation. It needs a real **Story Quality Control Layer** that behaves like a director, script supervisor, casting director, culture checker, prompt checker, audio supervisor, subtitle supervisor, and final assembly gatekeeper.

This layer is needed because AI story generation can produce beautiful but incorrect results:

- Story says “Nigerian village,” but prompt generates white American cast.
- Character is Black in scene 1, then white in scene 3.
- User selects Nigeria, but the scene looks like Europe or America.
- Short story becomes too long.
- Long story has no clear beginning, middle, and ending.
- Prompt does not match cast.
- Music repeats wrongly across emotional, action, fight, or sad scenes.
- Scene duration is not respected.
- AI writes confusing English that both native and second-language English users struggle to understand.
- Culture, clothing, food, names, environment, behavior, and cast do not match selected country or culture.

The solution is a **Story Construction Pipeline**:

```txt
User idea → Story Contract → Story Draft → Story Screening → Prompt Simplification → Culture Checking → Cast Bible → Cast Checking → Prompt vs Cast Validation → Scene Demarcation → Emotion Planning → Audio/Music Planning → Subtitle Planning → Continuity Checking → Provider Compatibility Checking → Final Assembly Approval
```

No story, scene, prompt, audio, or subtitle should go to final generation until it passes this supervisor chain.

---

# 1. Story Intake Profiler

This runs before story writing begins.

The user must be able to select:

```txt
Story Type:
- Short Story
- Long Story
- Children Story
- Movie
- Ad/Commercial
- Skit
- Moral Lesson
- Folklore
- Documentary Style
- Faith/Religious Story
- Educational Story

Country:
- Nigeria
- Ghana
- Kenya
- South Africa
- USA
- UK
- India
- etc.

Culture:
- Yoruba
- Igbo
- Hausa
- Edo
- Tiv
- Fulani
- General Nigerian Urban
- General African
- User Custom Culture

Scene Duration:
- 5 seconds per scene
- 8 seconds per scene
- 10 seconds per scene
- Custom

Story Length:
- 30 sec
- 60 sec
- 2 min
- 5 min
- 10 min+

Emotional Intensity:
- Normal
- More Emotional
- Very Emotional
- Cinematic
- Funny
- Dark
- Inspirational
- Suspense
- Action-heavy

Language Level:
- Normal English
- Simple English
- Nigerian English
- Children-friendly English
- Voiceover-friendly English
- Subtitle-friendly English

Subtitle Style:
- Normal Movie Subtitle
- Children Story Subtitle
- Karaoke / Word Highlight Subtitle
- Action Subtitle
- Emotional Subtitle
- Educational Subtitle

Generation Mode:
- Full Video
- Hybrid Image + Video + Audio
- Image Storybook
- Voiceover Story
- Children Song / Dance Style
```

This user setup becomes the **Story Contract**. Every supervisor must obey it.

Example Story Contract:

```json
{
  "country": "Nigeria",
  "culture": "Yoruba",
  "default_ethnicity": "Black African",
  "allow_race_override": true,
  "scene_duration_seconds": 5,
  "story_type": "short_story",
  "tone": "emotional",
  "language_level": "simple_english",
  "subtitle_style": "children_story",
  "generation_mode": "hybrid_image_video_audio"
}
```

---

# 2. Story Contract Object

Create a formal `StoryContract` object that is stored and passed through the whole story pipeline.

The Story Contract must store:

```txt
- country
- culture
- story type
- scene duration
- total duration
- cast assumptions
- language level
- emotional intensity
- music style
- subtitle style
- generation mode
- target audience
- age rating
- default ethnicity rules
- user override rules
- story length category
- output format
```

Example:

```json
{
  "storyId": "story_001",
  "country": "Nigeria",
  "culture": "Yoruba",
  "storyType": "short_story",
  "totalDurationSeconds": 60,
  "sceneDurationSeconds": 5,
  "estimatedSceneCount": 12,
  "languageLevel": "simple_english",
  "emotionalIntensity": "very_emotional",
  "subtitleStyle": "normal_movie",
  "generationMode": "hybrid",
  "targetAudience": "general",
  "ageRating": "family_safe",
  "defaultCastAssumptions": {
    "ethnicity": "Black Nigerian/African",
    "countryContext": "Nigeria",
    "allowWhiteCastOnlyIfUserRequests": true
  }
}
```

The Story Contract is the law of the story. If any supervisor finds a scene, prompt, cast, or sound cue that violates the Story Contract, it must block or correct it before generation.

---

# 3. Story Screening Supervisor

This supervisor reads the story and checks if it makes sense.

It checks:

```txt
- Does the story have a clear beginning?
- Does the story have a clear problem or conflict?
- Does the story have a resolution?
- Does the story fit the selected duration?
- Is the story too confusing?
- Are too many characters introduced?
- Does the ending feel complete?
- Is the story suitable for the selected story type?
- Does the story match the selected country and culture?
- Does the story match the target audience?
- Does the story have unnecessary scenes?
- Does the story have enough visual action for video?
- Does the story have too much narration and not enough scenes?
```

For **Short Story**, it must be strict:

```txt
Short story must not behave like a full movie.
It needs fast setup, clear problem, emotional turn, and clean ending.
```

For **Long Story**, it checks:

```txt
Long story needs act structure:
Act 1: setup
Act 2: conflict and escalation
Act 3: climax and resolution
```

Example output:

```json
{
  "story_passed": false,
  "score": 62,
  "issues": [
    "Story has no clear ending",
    "Too many characters for 60 seconds",
    "Main conflict starts too late"
  ],
  "recommended_fix": "Reduce cast to 3 people and move conflict into scene 2"
}
```

---

# 4. Prompt Simplifier Supervisor

Some AI stories sound big but do not make sense. This supervisor rewrites the story into simple, clear English without killing the meaning.

It should support:

```txt
- Simple English
- Nigerian English
- Children-friendly English
- Emotional cinematic English
- Voiceover-friendly English
- Subtitle-friendly English
```

Bad example:

```txt
Amidst the existential atmosphere of socioeconomic resistance, the young boy contemplated destiny.
```

Better example:

```txt
The young boy stood outside the shop, worried because his mother could not pay the rent.
```

This supervisor should not make the story childish unless the selected mode is children story. It should make it:

```txt
- clear
- visual
- understandable
- meaningful
- easy for English and English-as-second-language users to follow
- suitable for voiceover
- suitable for subtitles
- suitable for scene-by-scene video generation
```

It should also detect confusing scenes and rewrite them.

Example:

```json
{
  "passed": false,
  "issue": "Scene 4 is confusing and abstract",
  "original": "He battled the invisible storm of destiny",
  "revised": "He sat alone in the dark room, crying because he did not know what to do next"
}
```

---

# 5. Culture & Country Supervisor

This supervisor checks whether the story, cast, prompts, setting, clothing, food, names, and behavior match the selected country and culture.

Important default rule:

```txt
If user selects Nigeria or a Nigerian culture, default cast should be Black Nigerian/African unless the user explicitly requests white, Asian, mixed-race, foreigner, tourist, expatriate, or another ethnicity.
```

Examples:

```txt
If country = Nigeria
and culture = Yoruba / Igbo / Hausa / General Nigerian
then default cast ethnicity = Black African
unless user explicitly requests white, Asian, mixed-race, foreigner, tourist, expatriate, etc.
```

This supervisor checks:

```txt
- Names
- Skin tone / ethnicity
- Clothing
- Location
- Food
- House type
- Market type
- Vehicle type
- Accent/style of dialogue
- Social behavior
- Cultural respect
- Religion sensitivity
- Family structure
- Environment
- School setting
- Wedding setting
- Village setting
- Urban setting
- Class/status realism
```

Example issue:

```txt
User selected Nigeria + village story.
Prompt says: blonde woman in a snowy European village.
```

Supervisor correction:

```txt
Replace with: Black Nigerian woman in a rural Nigerian village, wearing simple Ankara wrapper, dusty road, warm daylight, compound houses.
```

Important:

This should not become racist or restrictive. It should be **context-aware**. A white person can appear in a Nigerian story if the user requests it or if the story explains it.

Allowed cases:

```txt
- User requested a white tourist in Lagos.
- Story is about a foreign businessperson in Nigeria.
- Story is about mixed-race family.
- Story is about international school.
- User manually overrides default ethnicity.
```

Blocked cases:

```txt
- User selected Nigerian village story and AI randomly makes the main family white.
- User selected Yoruba story and AI generates European clothing and snowy streets.
- User selected African folktale and AI generates American suburb.
```

---

# 6. Cast Bible Generator

Before scenes are generated, GHS must create a **Cast Bible**.

Every important character must have a stable identity.

Example Cast Bible entry:

```json
{
  "character_id": "char_mama_001",
  "name": "Mama Tola",
  "age": "45",
  "gender": "female",
  "ethnicity": "Black Nigerian Yoruba",
  "skin_tone": "dark brown",
  "body_type": "average",
  "hair": "black hair tied with scarf",
  "clothing": "blue Ankara wrapper and head tie",
  "role": "mother",
  "personality": "strict but loving",
  "voice_style": "warm adult Nigerian female voice",
  "relationship": "Tunde's mother"
}
```

Each character should include:

```txt
- character_id
- name
- age
- gender
- ethnicity
- skin tone
- body type
- hair
- clothing
- role
- personality
- voice style
- relationship to other characters
- emotional arc
- first scene appearance
- scenes where character appears
- costume changes if any
```

This prevents:

```txt
Scene 1: Mama Tola is dark-skinned.
Scene 2: Mama Tola becomes light-skinned.
Scene 3: Mama Tola becomes a young white woman.
```

Every scene prompt must reference the Cast Bible.

---

# 7. Cast Checking Supervisor

This supervisor checks every character against the Cast Bible.

It verifies:

```txt
- Character identity consistency
- Name consistency
- Age consistency
- Ethnicity consistency
- Skin tone consistency
- Clothing consistency unless scene changes
- Relationship consistency
- Voice consistency
- Character count per scene
- Character role consistency
- Whether a character appears in a scene where they should not be
- Whether a character disappears without story reason
```

Example output:

```json
{
  "passed": false,
  "blockingIssues": [
    "Character Mama Tola changes from Black Nigerian Yoruba woman to white woman in scene 3",
    "Tunde is described as 12 years old in Cast Bible but 18 years old in scene 5"
  ],
  "suggestedFixes": [
    "Update scene 3 prompt to match Cast Bible",
    "Change scene 5 age description back to 12-year-old boy"
  ]
}
```

---

# 8. Prompt vs Cast Supervisor

This supervisor compares every generated visual prompt with the Cast Bible.

Example:

Cast Bible says:

```txt
Tunde: 12-year-old Black Nigerian boy, short hair, school uniform.
```

But prompt says:

```txt
A white teenage boy with blonde hair walks into an American classroom.
```

Supervisor flags it:

```json
{
  "passed": false,
  "error": "Prompt does not match cast identity",
  "fix": "Replace with 12-year-old Black Nigerian boy with short hair wearing Nigerian school uniform."
}
```

This supervisor must run before every image/video prompt is approved.

It should block prompt generation if:

```txt
- prompt changes character race
- prompt changes age
- prompt changes gender
- prompt changes clothing without reason
- prompt changes location without reason
- prompt changes relationship
- prompt introduces new unnamed character wrongly
- prompt ignores selected country/culture
```

---

# 9. Prompt Demarcator / Scene Timing Supervisor

This is the “prompt demarcator.”

It breaks the story according to seconds.

Example:

User selects:

```txt
5 seconds per scene
Total video duration: 60 seconds
```

GHS calculates:

```txt
60 seconds ÷ 5 seconds = 12 scenes
```

So the story must be broken into 12 clean scene prompts.

Each scene gets:

```json
{
  "scene_number": 1,
  "duration": 5,
  "visual_prompt": "...",
  "voiceover": "...",
  "dialogue": "...",
  "music_mood": "...",
  "sfx": "...",
  "characters": ["char_tunde_001"],
  "location": "Lagos street"
}
```

This prevents long messy prompts.

Bad prompt:

```txt
A boy wakes up, goes to school, fights his friend, comes back home, cries, sees his mother, they pray, then he becomes successful.
```

Better demarcated:

```txt
Scene 1: Tunde wakes up in a small Lagos room.
Scene 2: He walks to school through a busy street.
Scene 3: His classmates laugh at his torn bag.
Scene 4: He hides behind the classroom and cries.
Scene 5: His teacher notices him and asks what happened.
Scene 6: Tunde explains that his mother cannot afford a new bag.
Scene 7: The teacher comforts him.
Scene 8: His classmates feel sorry.
Scene 9: They contribute money to help him.
Scene 10: Tunde receives a new bag.
Scene 11: He returns home smiling.
Scene 12: His mother hugs him and thanks God.
```

This supervisor should also stop GHS from creating a 22-minute story when the user selected 60 seconds.

---

# 10. Scene Density Supervisor

Not every 5-second scene can carry too much action.

Rules:

```txt
5 sec = one visual beat
10 sec = one action + emotional reaction
20 sec = small micro-scene
60 sec = full mini-story sequence
```

For 5 seconds:

```txt
One clear visual action only.
```

Good:

```txt
Tunde stands outside the classroom, holding his torn school bag, looking ashamed.
```

Bad:

```txt
Tunde enters school, argues with three boys, remembers his father, runs home, and meets his mother crying.
```

The supervisor must check:

```txt
- Is the action too much for the scene duration?
- Is dialogue too long?
- Are there too many characters?
- Are there too many camera movements?
- Is the prompt asking AI video provider to do too many things?
- Can this scene be understood visually in the selected duration?
```

---

# 11. Emotion Intensifier Supervisor

User can select:

```txt
- Normal
- More emotional
- Very emotional
- Cinematic
- Funny
- Dark
- Inspirational
- Suspense
- Action-heavy
```

The supervisor does not just add “more emotional.” It checks where emotion should rise.

Example emotion curve:

```txt
Scene 1: calm
Scene 2: worry
Scene 3: shame
Scene 4: tears
Scene 5: hope
Scene 6: victory
```

JSON example:

```json
{
  "scene_1": "calm",
  "scene_2": "concern",
  "scene_3": "humiliation",
  "scene_4": "sadness",
  "scene_5": "hope",
  "scene_6": "relief"
}
```

Then video prompt, voiceover, music, and subtitle style follow that emotion.

It should improve:

```txt
- facial expression
- body language
- lighting mood
- voiceover tone
- music selection
- camera movement
- subtitle animation
- pacing
```

Example:

Normal:

```txt
Tunde walks home.
```

Emotion intensified:

```txt
Tunde walks slowly along the dusty road, holding his torn school bag tightly, his eyes wet with tears as the evening sun fades behind him.
```

---

# 12. Music & Sound Supervisor

Not every scene should use the same music.

This supervisor creates a **music map**.

Example:

```json
{
  "scene_1": {
    "music": "soft morning ambience",
    "sfx": ["birds", "distant street noise"]
  },
  "scene_3": {
    "music": "low sad piano",
    "sfx": ["school bell", "children laughing faintly"]
  },
  "scene_6": {
    "music": "hopeful African percussion",
    "sfx": ["crowd cheering softly"]
  }
}
```

Rules:

```txt
- Same emotional section can share music.
- Fight/action scene needs different music.
- Sad scene needs different music.
- Suspense scene needs different music.
- Children song scene can use rhythm/dance music.
- Dialogue-heavy scene needs low background music.
- Voiceover must never fight with music volume.
- Repeated music must be intentional, not accidental.
- Transition between music tracks must not feel sudden unless the scene requires it.
```

Add a **Music Continuity Supervisor**:

```txt
Music Continuity Supervisor checks if music changes too suddenly or repeats wrongly.
```

It should detect:

```txt
- sad music used during fight scene
- fight music used during emotional scene
- same loop repeated across entire movie without reason
- music too loud over dialogue
- no ambience in scenes that need environment sound
- missing SFX for important actions
```

---

# 13. Dialogue & Voice Supervisor

This checks if characters speak correctly.

It checks:

```txt
- Is the dialogue too long for the scene duration?
- Does the voice match the character age?
- Does child voice sound like child?
- Does mother voice sound like adult woman?
- Does Nigerian story use suitable speech style?
- Is the voiceover simple enough?
- Is dialogue different from narration?
- Is the accent/tone suitable?
- Are too many narrators talking at once?
- Is there overlap between narrator and character dialogue?
```

Important rule:

```txt
5-second scene should not contain 40 words of dialogue.
```

Estimated speech duration rule:

```txt
Voiceover for 5 seconds: about 10–14 words max.
Voiceover for 10 seconds: about 20–28 words max.
```

This supervisor should also prevent the audio problem where more than one narrator or voice speaks at the same time.

It should validate:

```txt
- one narrator at a time unless intentional overlap is selected
- character dialogue does not clash with narration
- music volume ducks under voice
- SFX does not overpower dialogue
- child voices do not sound adult
- adult voices do not sound like children
```

---

# 14. Subtitle Style Supervisor

Styled subtitles should connect to story type.

Subtitle styles:

```txt
Normal Movie Subtitle
- clean white text
- small shadow
- bottom center

Children Story Subtitle
- bigger text
- word highlight
- bouncing animation
- colorful but readable

Music / Children Song Subtitle
- karaoke word-by-word highlight
- dance-like motion
- rhythm synced

Action Scene Subtitle
- sharp, fast, punchy
- not too much animation

Emotional Scene Subtitle
- slow fade
- soft style

Educational Subtitle
- clean readable text
- keyword highlight
- not too much movement
```

The subtitle supervisor checks:

```txt
- Is text readable?
- Is it too long?
- Does it block faces?
- Does animation match story type?
- Is subtitle timing synced with voice?
- Is the subtitle style suitable for children, movie, music, or education?
- Is the subtitle readable on mobile?
- Does subtitle color contrast with background?
```

This connects to the earlier idea:

```txt
When watching a movie, spoken words on screen are subtitles.
If the words have style, motion, or rhythm, they can be called animated subtitles, kinetic typography, styled captions, karaoke captions, or word-by-word subtitles depending on use.
```

---

# 15. Short Story Supervisor

For short story mode, force discipline.

Rules:

```txt
30 sec story:
- 6 scenes if 5 sec each
- max 2–3 main characters
- one location or two locations only
- conflict must appear early
- ending must be simple

60 sec story:
- 8–12 scenes
- max 3–4 main characters
- one main emotional arc
```

Short story structure:

```txt
Scene 1: Setup
Scene 2: Problem
Scene 3: Pressure
Scene 4: Emotional turn
Scene 5: Solution
Scene 6: Ending / message
```

The Short Story Supervisor must block:

```txt
- too many characters
- too many locations
- too much backstory
- slow intro
- unclear ending
- scenes that cannot fit selected duration
- long dialogue
- unnecessary subplots
```

---

# 16. Long Story Supervisor

For long story/movie mode, GHS needs stronger structure.

Rules:

```txt
- Create acts
- Create chapters
- Create character arcs
- Track locations
- Track time of day
- Track emotional progression
- Track unresolved plot points
- Track costume changes
- Track props
- Track music themes
- Track narrator style
```

Long story output should not go straight to video.

It should first create:

```txt
1. Story outline
2. Character Bible
3. Scene list
4. Chapter/Act structure
5. Audio plan
6. Prompt plan
7. Final generation plan
```

Long story must support:

```txt
Act 1: Setup
- introduce world
- introduce main character
- establish problem

Act 2: Conflict
- problem grows
- character struggles
- stakes increase

Act 3: Climax and Resolution
- final decision/action
- emotional payoff
- clear ending
```

---

# 17. Location & Environment Supervisor

This prevents wrong environments.

If user selects:

```txt
Nigeria + Lagos
```

The prompt should not produce:

```txt
snowy mountain road, European houses, American police car
```

It should suggest:

```txt
busy Lagos street, danfo buses, small shops, warm sunlight, concrete buildings, street vendors
```

If user selects:

```txt
Nigeria + village
```

It can use:

```txt
dusty road, compound houses, trees, market stalls, local clothing, warm daylight
```

This supervisor checks:

```txt
- country realism
- city/village realism
- building type
- weather
- road type
- vehicles
- market/store design
- school environment
- home environment
- religious/cultural setting
- time of day consistency
```

---

# 18. Costume & Props Supervisor

This checks clothing and objects.

Example:

Yoruba wedding story:

```txt
- agbada
- gele
- aso-ebi
- traditional drums
```

School story:

```txt
- school uniform
- backpack
- classroom
- exercise books
```

Village farming story:

```txt
- cutlass
- basket
- farm path
- wrapper
```

It also checks continuity:

```txt
If character wears red dress in scene 1 and no costume change happens, scene 2 should not change to blue suit.
```

It should detect:

```txt
- wrong cultural clothing
- wrong props for scene
- props disappearing without reason
- clothing changing without reason
- modern object appearing in traditional scene without reason
- costume not matching age/status/role
```

---

# 19. Continuity Supervisor

This is one of the most important supervisors.

It checks:

```txt
- Character appearance
- Clothing
- Props
- Time of day
- Location
- Weather
- Injuries
- Emotional state
- Object position
- Story timeline
- Scene order
- Character relationships
- Voice consistency
- Music continuity
- Subtitle style continuity
```

Example:

```txt
Scene 4: Tunde’s bag tears.
Scene 5: Bag should still be torn unless repaired.
```

Another example:

```txt
Scene 6: It is night.
Scene 7: It should not become afternoon unless story says next day.
```

Continuity supervisor should create a **Continuity Ledger**:

```json
{
  "scene_4": {
    "important_changes": [
      "Tunde's bag tears",
      "Tunde begins crying",
      "Schoolmates laugh at him"
    ]
  },
  "scene_5_requirements": [
    "Tunde's bag remains torn",
    "Tunde still looks sad",
    "Scene remains at school unless transition says otherwise"
  ]
}
```

---

# 20. Scene Prompt Builder

After all supervisors approve the story, GHS generates final prompts.

Each scene should have separate prompts:

```json
{
  "scene_id": "scene_004",
  "duration": 5,
  "image_prompt": "...",
  "video_prompt": "...",
  "negative_prompt": "...",
  "voiceover_text": "...",
  "dialogue": "...",
  "subtitle_style": "...",
  "music_cue": "...",
  "sfx_cues": [],
  "characters": [],
  "location": "",
  "camera_style": "",
  "emotion": ""
}
```

Do not use one giant prompt for the whole movie.

Every scene should include:

```txt
- scene_id
- scene_number
- duration
- title/beat name
- summary
- characters
- location
- time of day
- emotion
- visual prompt
- image prompt
- video prompt
- negative prompt
- camera direction
- voiceover text
- dialogue
- subtitle text
- subtitle style
- music cue
- SFX cue
- continuity notes
- provider notes
```

---

# 21. AI Provider Compatibility Supervisor

Different AI providers behave differently.

This supervisor checks:

```txt
- Is prompt too long for provider?
- Is scene too complex?
- Is character identity description strong enough?
- Should this be image-only instead of video?
- Should scene use hybrid image + audio instead of expensive video?
- Is the scene suitable for Kling, Runway, FAL, or another provider?
- Does the provider support the requested motion?
- Should prompt be simplified before provider call?
```

For GHS hybrid movie mode, this is powerful:

```txt
Calm scene = image + camera motion
Action scene = video
Emotional close-up = video
Narration scene = image + voiceover
```

This saves cost and improves quality.

The supervisor should recommend:

```json
{
  "scene_1": {
    "recommended_generation": "image_plus_motion",
    "reason": "Calm intro scene; no expensive video needed"
  },
  "scene_4": {
    "recommended_generation": "video",
    "reason": "Emotional crying close-up needs motion"
  },
  "scene_7": {
    "recommended_generation": "video",
    "reason": "Fight/action scene needs real movement"
  }
}
```

---

# 22. Final Assembly Gatekeeper

Before final render, this supervisor gives a pass/fail report.

Example:

```json
{
  "final_status": "blocked",
  "blocking_issues": [
    "Scene 3 prompt changes Tunde ethnicity",
    "Scene 5 voiceover is too long for 5 seconds",
    "Scene 7 music repeats fight music during sad scene"
  ],
  "warnings": [
    "Scene 2 and scene 3 location may look too similar"
  ],
  "ready_for_generation": false
}
```

Only when passed:

```json
{
  "ready_for_generation": true
}
```

Gatekeeper must return:

```txt
- passed
- score
- blocking issues
- warnings
- suggested fixes
- fixed version if possible
- ready_for_generation true/false
```

If blocking issues exist, do not allow final generation.

The user should see a review screen with:

```txt
- Story Quality Score
- Cast Consistency Score
- Culture Match Score
- Timing Score
- Audio/Music Score
- Subtitle Score
- Continuity Score
- Provider Compatibility Score
- Blocking Issues
- Warnings
- AI Suggested Fixes
- Approve Fixes button
- Regenerate Story button
- Continue Anyway only if issues are not blocking
```

---

# 23. Supervisor Return Format

Each supervisor should return the same structure:

```ts
type SupervisorResult<T = unknown> = {
  passed: boolean;
  score: number;
  blockingIssues: string[];
  warnings: string[];
  suggestedFixes: string[];
  revisedData?: T;
  metadata?: Record<string, unknown>;
};
```

Example:

```json
{
  "passed": false,
  "score": 71,
  "blockingIssues": [
    "Prompt changes main character ethnicity"
  ],
  "warnings": [
    "Voiceover may be slightly long for 5 seconds"
  ],
  "suggestedFixes": [
    "Rewrite prompt using Cast Bible identity"
  ],
  "revisedData": {
    "fixedPrompt": "12-year-old Black Nigerian boy with short hair wearing school uniform..."
  }
}
```

---

# 24. Suggested Folder Architecture

Create modular backend validation files:

```txt
/lib/story-supervisors/
  index.ts
  types.ts
  story-contract.ts
  story-screening.ts
  prompt-simplifier.ts
  culture-supervisor.ts
  cast-bible.ts
  cast-checking.ts
  prompt-cast-validator.ts
  scene-demarcator.ts
  scene-density.ts
  emotion-intensifier.ts
  music-supervisor.ts
  music-continuity.ts
  dialogue-voice-supervisor.ts
  subtitle-style-supervisor.ts
  short-story-supervisor.ts
  long-story-supervisor.ts
  location-environment-supervisor.ts
  costume-props-supervisor.ts
  continuity-supervisor.ts
  scene-prompt-builder.ts
  provider-compatibility.ts
  final-gatekeeper.ts
```

Possible API route:

```txt
/app/api/story/supervise/route.ts
/app/api/story/generate-contract/route.ts
/app/api/story/build-cast-bible/route.ts
/app/api/story/demarcate-scenes/route.ts
/app/api/story/final-gatekeeper/route.ts
```

Possible database tables:

```txt
StoryProject
StoryContract
StoryDraft
StoryCastCharacter
StoryScene
StorySupervisorReport
StoryMusicCue
StorySubtitlePlan
StoryContinuityLedger
StoryGenerationPlan
```

---

# 25. Full Supervisor Pipeline Order

The full pipeline should run in this order:

```txt
1. Story Intake Profiler
2. Story Contract Builder
3. Story Screening Supervisor
4. Prompt Simplifier Supervisor
5. Culture & Country Supervisor
6. Cast Bible Generator
7. Cast Checking Supervisor
8. Prompt vs Cast Consistency Supervisor
9. Scene Demarcator / Timing Supervisor
10. Scene Density Supervisor
11. Emotion Intensifier Supervisor
12. Music & Sound Supervisor
13. Music Continuity Supervisor
14. Dialogue & Voice Supervisor
15. Subtitle Style Supervisor
16. Short Story Supervisor
17. Long Story Supervisor
18. Location & Environment Supervisor
19. Costume & Props Supervisor
20. Continuity Supervisor
21. Scene Prompt Builder
22. AI Provider Compatibility Supervisor
23. Final Assembly Gatekeeper
```

---

# 26. Claude Code Build Instruction

Give Claude Code this full instruction:

```txt
Build a Story Quality Control Layer for GHS before final video/audio assembly.

Create a supervisor pipeline for the Story section where GPT/Claude writes story, but no story is allowed to go directly to generation until it passes these supervisors:

1. Story Intake Profiler
2. Story Contract Builder
3. Story Screening Supervisor
4. Prompt Simplifier Supervisor
5. Culture & Country Supervisor
6. Cast Bible Generator
7. Cast Checking Supervisor
8. Prompt vs Cast Consistency Supervisor
9. Scene Demarcator / Timing Supervisor
10. Scene Density Supervisor
11. Emotion Intensifier Supervisor
12. Music & Sound Supervisor
13. Music Continuity Supervisor
14. Dialogue & Voice Supervisor
15. Subtitle Style Supervisor
16. Short Story Supervisor
17. Long Story Supervisor
18. Location & Environment Supervisor
19. Costume & Props Supervisor
20. Continuity Supervisor
21. Scene Prompt Builder
22. AI Provider Compatibility Supervisor
23. Final Assembly Gatekeeper

The user must be able to select country, culture, story type, scene duration, total duration, emotional intensity, language simplicity, subtitle style, and generation mode.

Important default rule:
If user selects Nigeria or a Nigerian culture, default cast should be Black Nigerian/African unless the user explicitly requests white, Asian, mixed-race, foreigner, tourist, expatriate, or another ethnicity. Do not randomly generate white cast for Nigerian stories.

Create a Story Contract object that stores:
- country
- culture
- story type
- scene duration
- total duration
- cast assumptions
- language level
- emotional intensity
- music style
- subtitle style
- generation mode
- target audience
- age rating
- user override rules

Create a Cast Bible before scene prompts. Every character must have a stable character_id, name, age, gender, ethnicity, skin tone, clothing, voice style, role, personality, and relationship to other characters.

Every scene prompt must reference the Cast Bible. Add a validator that compares scene prompt against cast identity and blocks generation if the prompt changes race, age, clothing, character role, or location without story reason.

Create a Scene Demarcator:
- If user selects 5 seconds per scene, each scene must contain only one clear visual beat.
- Calculate number of scenes from total_duration / scene_duration.
- Break story into exact scene objects.
- Each scene must include visual prompt, voiceover, dialogue, music cue, SFX cue, emotion, subtitle style, characters, location, duration, and camera direction.

Create a Scene Density Supervisor:
- 5 sec = one visual beat.
- 10 sec = one action + emotional reaction.
- 20 sec = small micro-scene.
- Block scenes that contain too much action for their duration.

Create an Emotion Intensifier Supervisor:
- Build an emotion curve across scenes.
- Intensify only where needed.
- Make video prompt, voiceover, music, camera, and subtitle style follow the emotional arc.

Create a Music Supervisor:
- Do not repeat one music track blindly across the whole movie.
- Group scenes by emotion.
- Fight/action scenes need separate music.
- Sad scenes need separate music.
- Suspense scenes need separate music.
- Dialogue scenes need low music.
- Children song scenes need rhythm/karaoke style.
- Validate that music does not overpower voiceover.

Create a Dialogue & Voice Supervisor:
- Check that voice matches character age/gender/role.
- Check that dialogue fits scene duration.
- Prevent multiple narrators from talking at the same time unless intentionally selected.
- Prevent narration, dialogue, music, and SFX from clashing.

Create a Subtitle Style Supervisor:
- Normal movie subtitles should be clean and readable.
- Children story subtitles can be bigger, animated, and word-highlighted.
- Music/children song subtitles can use karaoke word-by-word highlighting.
- Action subtitles should be sharp but not distracting.
- Emotional subtitles should be soft and slow.
- Validate readability, mobile visibility, sync, and face blocking.

Create Short Story and Long Story Supervisors:
- Short Story Supervisor should enforce discipline: limited characters, clear conflict, fast setup, simple ending.
- Long Story Supervisor should create act structure, chapters, character arcs, locations, continuity, and generation plan before video.

Create Location, Costume, Props, and Continuity Supervisors:
- Check country realism.
- Check culture realism.
- Check clothing.
- Check props.
- Track time of day, weather, injuries, emotional state, object position, and story timeline.

Create a Scene Prompt Builder:
- Do not use one giant prompt for the whole movie.
- Each scene must have its own image prompt, video prompt, negative prompt, voiceover, dialogue, subtitle style, music cue, SFX cue, characters, location, camera direction, and emotion.

Create an AI Provider Compatibility Supervisor:
- Check if prompt is too long or complex for provider.
- Recommend video, image+motion, or hybrid based on scene type.
- Calm scenes can use image + motion.
- Action scenes use video.
- Emotional close-ups can use video.
- Narration scenes can use image + voiceover.

Create a Final Assembly Gatekeeper:
- It returns passed, warnings, blocking issues, and fixed version.
- If blocking issues exist, do not allow final generation.
- Show the user a review screen with detected problems and AI-suggested fixes.

The architecture should be modular:
- /lib/story-supervisors/
- /lib/story-supervisors/story-screening.ts
- /lib/story-supervisors/prompt-simplifier.ts
- /lib/story-supervisors/culture-supervisor.ts
- /lib/story-supervisors/cast-bible.ts
- /lib/story-supervisors/cast-checking.ts
- /lib/story-supervisors/prompt-cast-validator.ts
- /lib/story-supervisors/scene-demarcator.ts
- /lib/story-supervisors/scene-density.ts
- /lib/story-supervisors/emotion-intensifier.ts
- /lib/story-supervisors/music-supervisor.ts
- /lib/story-supervisors/music-continuity.ts
- /lib/story-supervisors/dialogue-voice-supervisor.ts
- /lib/story-supervisors/subtitle-style-supervisor.ts
- /lib/story-supervisors/short-story-supervisor.ts
- /lib/story-supervisors/long-story-supervisor.ts
- /lib/story-supervisors/location-environment-supervisor.ts
- /lib/story-supervisors/costume-props-supervisor.ts
- /lib/story-supervisors/continuity-supervisor.ts
- /lib/story-supervisors/scene-prompt-builder.ts
- /lib/story-supervisors/provider-compatibility.ts
- /lib/story-supervisors/final-gatekeeper.ts

Each supervisor should return:
{
  passed: boolean,
  score: number,
  blockingIssues: string[],
  warnings: string[],
  suggestedFixes: string[],
  revisedData?: object
}

Do not make this only UI. It must be real backend validation before final assembly.
```

---

# 27. Example Final Scene Object

```json
{
  "scene_id": "scene_004",
  "scene_number": 4,
  "duration": 5,
  "title": "Tunde Hides and Cries",
  "summary": "Tunde hides behind the classroom after classmates laugh at his torn bag.",
  "characters": ["char_tunde_001"],
  "location": "Nigerian primary school classroom exterior",
  "time_of_day": "afternoon",
  "emotion": "sadness",
  "visual_prompt": "A 12-year-old Black Nigerian boy with short hair wearing a school uniform hides behind a classroom wall, holding a torn school bag, eyes wet with tears, warm afternoon light, Nigerian school environment.",
  "image_prompt": "12-year-old Black Nigerian boy, short hair, school uniform, torn school bag, hiding beside classroom wall, sad expression, Nigerian primary school, warm daylight, cinematic emotional shot.",
  "video_prompt": "The boy slowly leans against the classroom wall and wipes tears from his face while holding his torn school bag tightly. Subtle camera push-in, emotional tone.",
  "negative_prompt": "white child, blonde hair, American school, snow, modern luxury classroom, wrong uniform, extra characters",
  "voiceover_text": "Tunde felt ashamed and wished he could disappear.",
  "dialogue": "",
  "subtitle_text": "Tunde felt ashamed and wished he could disappear.",
  "subtitle_style": "emotional_soft_fade",
  "music_cue": "low sad piano with soft African ambience",
  "sfx_cues": ["distant school bell", "children laughing faintly"],
  "camera_style": "slow push-in close-up",
  "continuity_notes": [
    "Tunde's bag remains torn after this scene",
    "Tunde remains emotionally sad in the next scene unless comforted"
  ],
  "provider_recommendation": "video",
  "provider_reason": "Emotional close-up benefits from motion"
}
```

---

# 28. Bitter Truth / Product Direction

This feature is not small, but it is exactly the kind of thing that can make GHS different.

Many AI video tools generate beautiful nonsense. GHS should not be another tool that generates random video from random prompts.

GHS should behave like:

```txt
- director
- script supervisor
- casting director
- culture checker
- prompt engineer
- audio director
- subtitle designer
- editor
- final quality gatekeeper
```

Main rule:

```txt
Do not generate first and fix later.
Screen, structure, validate, then generate.
```

That is what will make GHS feel professional instead of random.

---

# 29. Non-Negotiable Rules

```txt
1. No story goes to final generation without Story Contract.
2. No scene goes to generation without Cast Bible validation.
3. No Nigerian story should randomly generate white cast unless user requested it.
4. No 5-second scene should contain too much action.
5. No voiceover should exceed scene timing.
6. No music should blindly repeat across every scene.
7. No subtitle should block faces or become unreadable.
8. No long story should skip act/chapter planning.
9. No short story should behave like a full movie.
10. No final assembly should happen if blocking issues exist.
11. Supervisor validation must happen in backend logic, not only UI.
12. The user should see detected issues and suggested fixes before final generation.
```

---

# 30. Final Product Name Ideas For This Layer

Possible internal names:

```txt
- GHS Story Supervisor Layer
- GHS Story Quality Control Layer
- GHS Script Intelligence Layer
- GHS Director Layer
- GHS Creative Supervisor
- GHS Story Gatekeeper
- GHS Production Brain
- GHS Story Brain
- GHS Continuity Engine
- GHS Culture & Cast Engine
```

Recommended name:

```txt
GHS Story Quality Control Layer
```

It is clear, professional, and explains exactly what it does.

