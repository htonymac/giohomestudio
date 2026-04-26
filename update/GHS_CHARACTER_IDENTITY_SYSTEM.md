# GHS Character Identity System — Full Reusable Identity Objects

## Saved: 2026-04-12
## Status: IMPLEMENTATION SOURCE OF TRUTH

---

## Core Rule
A character in GHS must NOT behave like plain prompt text.
A character must behave like a reusable identity object with:
- persistent character ID
- structured metadata
- continuity rules
- reference images
- export/import support
- cross-section usability

## Main Expected Behavior
If user creates JON_RABBIT848 with appearance details (skin/fur color, hair type, age, height, species, face structure, tail uniqueness, clothing, nationality), then when user imports that character into ANY section (Text-to-Video, Hybrid, Movie, Short Video, Children Story), the user MUST NOT need to re-describe the character.

User types: "JON_RABBIT848 bought a white car and came home with his family to celebrate"
GHS auto-resolves JON_RABBIT848 into full identity package during generation.

## Implementation Phases

### Phase 1: Character Schema + Storage
- Character object schema with all identity fields
- Continuity fields (locks for skin, hair, face, body, clothing)
- Reference image handling (3+ angles)

### Phase 2: Character Picker + Quick Preview + Cast Tray
- Import Character / Use Saved Character in all sections
- Quick preview with larger image, alternate views, identity summary
- Project cast tray with thumbnails, insert action
- Prompt token insertion at cursor position

### Phase 3: AI Smart Builder
- Free prompt input ("male india fair 45")
- Guided structured selection (human/animal/robot/fantasy)
- AI transforms rough input into structured character data
- Multi-image generation (front, 3/4, side views)

### Phase 4: Token Resolution Engine
- Scan prompt for character IDs on Create/Build/Generate
- Resolve each token into saved identity object
- Attach metadata + reference images to generation job
- Internal prompt assembly layer

### Phase 5: Export/Import + Cross-Section
- ZIP download: images/ + description.txt + character.json
- Import from ZIP
- Reusable across all GHS sections

## Acceptance Criteria
- Legacy character flow still works
- Smart AI builder exists
- Saved characters can be previewed and selected
- Character token insertable into prompts
- User does NOT re-describe saved characters
- Backend auto-expands character token into full identity context
- Reference images attached during generation
- Continuity preserved across scenes
- Character exportable as ZIP
- Character reusable across ALL GHS sections
