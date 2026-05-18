# Era + Culture Lock System — Full Implementation Spec

**Date:** 2026-05-18  
**Author:** Claude Code / Henry  
**Priority:** CRITICAL — blocks all image generation quality  
**Status:** PLAN — not yet built  

---

## THE PROBLEM (plain language)

When a user sets their story in **Nigeria 2024**, the scene board generates cavemen.  
When a user sets their story in **899 AD**, the scene board generates modern day people.  
When a user picks **Nollywood culture**, the images look like primitive Africa, not Lagos.

**Root cause:** The image generation pipeline has NO knowledge of:
- What year the story is set in
- What culture/society the story belongs to
- What "visually correct" means for that era + culture combo

The AI model fills the gap with its own guess — which is always wrong.

**This spec locks it permanently.**

---

## THE SOLUTION (one sentence)

Every story has two mandatory locks — **Era Lock** and **Culture Lock** — that get injected into 100% of image generation prompts as hard constraints, with a matching negative prompt that actively blocks any elements from the wrong era or wrong culture.

---

## SECTION 1 — THE TWO LOCKS DEFINED

### 1A. Era Lock

The Era Lock tells the image model:
- What year/period the story is set in
- What technology existed at that time
- What clothing, architecture, lighting existed at that time
- What is STRICTLY FORBIDDEN (things that did not exist yet)

**User input:** A free text field in the Story tab: `"2024"` / `"1819"` / `"899 AD"` / `"300 BC"` / `"ancient Egypt"` / `"Victorian England"` / `"today"`

**System output:** A locked positive directive + a locked negative directive, both injected into every scene image prompt.

### 1B. Culture Lock

The Culture Lock tells the image model:
- What ethnic/regional society the story belongs to
- What clothing, hairstyles, architecture look like for that society
- What environment, colors, materials are typical
- Combined with Era Lock for maximum accuracy

**User input:** Derived from the existing Art Style picker (Nollywood = Nigerian culture, Realistic = neutral, etc.) PLUS a new optional `Story Culture` field for precision (e.g., "Yoruba", "Victorian English", "Meiji Japanese", "Medieval French")

---

## SECTION 2 — ERA VISUAL MAP (complete lookup table)

The system parses the user's era input into a year number, then matches it to this table.  
The system uses the POSITIVE directive in the scene image prompt.  
The system uses the NEGATIVE directive in the negative prompt.

---

### ERA: 10000 BC and earlier (Prehistoric / Stone Age)

**Positive:**  
Stone Age. Paleolithic era. Rough stone tools only. Cave paintings. Animal skin clothing, no weaving yet. No metal of any kind. Open fire only. Caves and rock shelters. No agriculture. Hunter-gatherer society. Bones and stones as tools. Raw, untouched natural landscape.

**Negative:**  
metal, swords, armor, castles, buildings, writing, books, wheels, pottery, agriculture, woven fabric, any modern element, Roman columns, medieval, Victorian, contemporary, electricity, glass windows

---

### ERA: 10000 BC – 3000 BC (Neolithic / Early Civilization)

**Positive:**  
Neolithic era. Early settlements. Mud-brick and wattle construction. Early pottery and weaving. Simple woven cloth. Stone tools and early copper. Open fires and clay ovens. No written language. Village life, communal farming, early domesticated animals. River-based settlements.

**Negative:**  
metal swords, iron armor, castles, glass windows, printed text, paved roads, modern clothing, electricity, any technology past copper age

---

### ERA: 3000 BC – 500 BC (Ancient Civilizations — Bronze Age / Classical Ancient)

**Positive:**  
Ancient civilization. Bronze age. Sandals, linen or wool robes, draped garments. Open-air temples and stone columns. Clay oil lamps and torches. Papyrus scrolls. Chariots and horses. City-states. Merchants with clay tablets. Outdoor markets with amphorae. No glass windows. No chimneys.

**Negative:**  
iron plate armor, medieval castles, printing press, gunpowder, chimneys, pants (unless culturally accurate), modern shoes, electricity, any element post-500 AD

---

### ERA: 500 BC – 500 AD (Classical Antiquity — Greek / Roman / Han / Ancient African Kingdoms)

**Positive:**  
Classical antiquity era. Roman or Greek columns, togas and tunics, sandals, mosaic floors, aqueducts, wooden carts, olive oil lamps, wax tablets, gladius swords and shields, laurel wreaths, chariot races, baths and forums, legionnaire armor. For African settings: Nok culture, Kingdom of Kush, stone-carved temples, gold and bronze jewelry, ivory, fine woven garments.

**Negative:**  
plate armor, medieval castles, printing press, cannon, gunpowder, firearms, stirrups, pants (European), glass windows, chimneys, clocks, any post-500 AD technology

---

### ERA: 500 AD – 1000 AD (Early Medieval / Dark Ages / Early Islamic Golden Age / Viking Age)

**Positive:**  
Early medieval period. Chainmail and iron weapons. Thatched and timber longhouses. Torches and rushlight. Parchment manuscripts. Horses with saddles and stirrups. Norman and Saxon clothing — wool tunics, leather boots, cloaks with brooches. Viking longships. Byzantine gold mosaics. Islamic calligraphy and arched mosques. For African settings: early Swahili coast trade, Ghana Empire gold trade, mud-brick and timber structures, kente cloth early forms.

**Negative:**  
plate armor (full suits), printing press, gunpowder, cannons, glass windows (common), chimneys, clocks, eyeglasses, any post-1000 AD technology, modern clothing, electricity

---

### ERA: 1000 AD – 1300 AD (High Medieval / Crusades Era / Mali Empire)

**Positive:**  
High medieval period. Full plate and chainmail armor. Gothic stone churches and castles. Stained glass windows (churches only). Candles and torches. Quill and ink manuscripts. Knights on horseback. Feudal villages with market squares. For African settings: Mali Empire, Great Zimbabwe stone ruins, trans-Saharan gold trade caravans, ornate robes and turbans, Mansa Musa-era opulence.

**Negative:**  
gunpowder, cannon, printing press, chimneys (common), eyeglasses (common), pocket watches, modern roads, any post-1300 technology

---

### ERA: 1300 AD – 1500 AD (Late Medieval / Early Renaissance)

**Positive:**  
Late medieval era. Full plate armor on knights. Gothic architecture. Illuminated manuscripts. Early printing press (late 1400s only). Cathedrals with flying buttresses. Plague doctors in early period. Market towns with guild signs. Fur-lined robes for nobility. Cobblestone streets. For African settings: Songhai Empire, Benin bronze casting, royal courts with elaborate beaded regalia, Timbuktu as center of learning.

**Negative:**  
firearms (muskets), widespread printing, chimneys on all buildings, Baroque architecture, any post-1500 clothing or technology

---

### ERA: 1500 – 1650 (Renaissance / Early Modern / Songhai Empire Peak)

**Positive:**  
Renaissance era. Doublets and ruffs for men, corseted gowns for women. Oil paintings and perspective art. Early muskets and pikes. Galleons and tall ships. Cobblestone city streets. Gutenberg-era books. Guild craftsmen. For African settings: Songhai Empire height, Benin Kingdom bronze art, Great Mosque of Djenné, elaborate court dress, gold and ivory trade.

**Negative:**  
powdered wigs, flintlock pistols common, Baroque architecture dominant, steam or mechanical devices, modern clothing, electricity

---

### ERA: 1650 – 1750 (Baroque / Colonial Era)

**Positive:**  
Baroque period. Powdered wigs, lace cravats, silk waistcoats, long coats. Flintlock pistols and muskets. Carriages on cobblestone streets. Candles and oil lanterns. Harpsichords. Formal gardens. Colonial expansion. Tall ship fleets. For African settings: Kingdom of Dahomey warrior culture, Ashanti gold trade, Atlantic slave trade context (handle sensitively), elaborate textile traditions.

**Negative:**  
top hats (Victorian), industrial machinery, steam engines, electrical light, photography, railways, modern guns, contemporary clothing

---

### ERA: 1750 – 1820 (Enlightenment / Georgian / Pre-Industrial)

**Positive:**  
Georgian or Enlightenment era. Tricorn hats, frock coats, knee breeches, powdered or natural hair. Empire-line dresses for women. Candlelit drawing rooms. Horse-drawn coaches. Quill pens and inkwells. Scientific instruments. Dueling pistols. Coffee houses and periodicals. For African settings: Oyo Empire expansion, Fulani jihad era, intricate cloth weaving, brass and bronze royal artifacts.

**Negative:**  
steam trains (in motion), top hats dominant, Victorian dress, photography, telegraphy, industrial factories, modern roads, electrical light

---

### ERA: 1820 – 1870 (Industrial Revolution / Victorian Early / Missionary Era Africa)

**Positive:**  
Early Victorian / Industrial era. Top hats and frock coats. Corsets, crinolines, and bonnets. Steam trains and early factories. Gas lighting in cities. Daguerreotype photography (late period). Omnibus horse carriages. Telegraphs. Cast iron architecture. For African settings: missionary influence period, colonial forts and trading posts alongside traditional kingdoms, Victorian-era Lagos or Cape Town mix of European and African dress.

**Negative:**  
automobiles, electric light, telephones, bicycles common, photography (before 1840), any post-1870 clothing or technology

---

### ERA: 1870 – 1914 (High Victorian / Edwardian / Late Colonial Africa)

**Positive:**  
High Victorian or Edwardian era. Bustles and tailored suits. Bicycles, early motorcars (late period). Electric street lighting (cities). Telephone exchanges. Steamships. Bowler hats. Parasols. Formal dining rooms. For African settings: colonial administrative buildings alongside market compounds, missionaries, early African newspapers, Yoruba indigo-dyed adire cloth, returnee Brazilian-influenced architecture in Lagos.

**Negative:**  
aircraft, radio, early cinema (before 1895), fully modern fashion, skyscrapers

---

### ERA: 1914 – 1945 (World Wars Era / Jazz Age / Early African Nationalism)

**Positive:**  
Interwar era. Art Deco architecture. Cloche hats and flapper dresses (1920s). Military uniforms (1940s). Early radio sets. Black and white cinema. Automobiles — rounded body styles. Telegram offices. For African settings: early independence movements, West African Pilot newspaper era, early urban Lagos/Accra/Nairobi, mix of traditional and Western dress, galoshes and lace-up shoes.

**Negative:**  
smartphones, computers, post-1945 cars, television, color film dominant, modern glass architecture

---

### ERA: 1945 – 1980 (Post-War / Independence Era / Afro-funk)

**Positive:**  
Mid 20th century. Post-war modernism. Fin-tailed cars. Black and white then color TV. Vinyl records. For African settings: independence era 1960s — flowing boubou and agbada, military uniform coups, pan-African pride, Afrobeat music era, Volkswagen Beetles and Peugeot 504s, colorful political rally scenes, outdoor cinemas, long braids and afro hairstyles.

**Negative:**  
smartphones, internet, flat-screen TVs, modern SUVs, post-1980 fashion, social media

---

### ERA: 1980 – 2000 (80s–90s)

**Positive:**  
1980s–90s. Large mobile phones or no phones. Boomboxes. VHS cassettes. Neon colors (80s), grunge (90s). Older model cars — box-shaped. CRT televisions. Cassette tapes. For African settings: Nollywood VHS era, market stalls with cassette hawkers, okada motorcycle taxis, 90s fashion — bright prints, shoulder pads, high-waist jeans, Aba-made shoes.

**Negative:**  
smartphones, flatscreen TV, social media, post-2000 cars, Instagram, streaming

---

### ERA: 2000 – 2015 (Early 21st Century)

**Positive:**  
Early 2000s to 2010s. Early smartphones (iPhone era late period). Flat-screen TVs. SUVs and sedans. Social media emerging. For African settings: Nollywood DVD era, BRT buses in Lagos, bank branch queues, generator sounds, DSTV satellite dishes on rooftops, Ankara fashion resurgence, Blackberry phones.

**Negative:**  
TikTok, AI, post-2015 phone designs, modern electric cars, streaming-only culture

---

### ERA: 2015 – Present (Contemporary Modern)

**Positive:**  
Contemporary modern era. Smartphones everywhere. Streaming culture. Modern architecture. Electric cars. Social media visible. For African settings: contemporary Lagos — Lekki high-rises, Bole food stalls, Afrobeats concerts, modern Ankara fashion mixed with streetwear, Lagos traffic on expressways, ride-share apps, Afrocentric Instagram aesthetic.

**Negative:**  
horses as transport, medieval clothing, ancient ruins as setting, primitive tools, any pre-industrial technology

---

## SECTION 3 — CULTURE VISUAL MAP

Culture defines ethnicity, society, fashion, and environment. Combined with era for full lock.

### NIGERIAN / WEST AFRICAN CULTURES

**Contemporary (2000–present):**  
Ankara print fabric, lace aso-ebi, gele headwraps, modern Agbada, stiletto heels and loafers, Lagos highrise skyline, yellow danfo buses, okada motorcycles, open-air markets, tropical heat, palm trees, corrugated iron rooftops, generator exhaust, Nollywood movie posters, jollof rice and suya smoke.

**Colonial era (1860–1960):**  
White or khaki colonial administrator uniforms alongside traditional wear. Church missionary schools. Mud-brick compounds with corrugated iron introduced. Agbada and iro-buba traditional dress persisting. Colonial court buildings, Lagos Marina waterfront, early railway stations.

**Pre-colonial kingdoms (before 1860):**  
Yoruba: coral bead crowns (ade), aso-oke woven cloth, bronze casting, palace courtyards with carved wooden doors, talking drum ceremonies, masquerade festivals, mud-brick compound architecture with open central courtyard.  
Igbo: chi shrines, obi community halls, elaborate face and body painting, iron-smelting, trade beads.  
Hausa-Fulani: walled city gates (Kofar), turban and babanriga, Islamic architecture, leather crafts, trans-Saharan trade routes.  
Benin Kingdom: elaborate bronze plaques and ivory carvings, royal processional courts, beaded royal dress.

### EUROPEAN CULTURES (see era-specific in Section 2 above)

**English:** Specific to era. Key markers: tea culture at all eras, class system visible in dress.  
**French:** Specific to era. Key markers: cafés, fashion leadership, République symbols.  
**German/Nordic:** Specific to era. Key markers: timber architecture in medieval, precision industry in modern.  

### JAPANESE CULTURES

**Contemporary:** Neon-lit Shibuya, business suits, kawaii fashion, vending machines, trains.  
**Meiji (1868–1912):** Mix of kimono and Western suits, rickshaws, European-influenced government buildings alongside temples.  
**Edo (1603–1868):** Kimono only, samurai with two swords, tatami interiors, paper lanterns, temple gates, no Western elements.  
**Feudal (pre-1600):** Warring states, ashigaru foot soldiers, basic castle keeps, rice paddies.  

### MIDDLE EASTERN / ARAB CULTURES

**Contemporary:** Gulf cities — glass towers, abayas and dishdasha, luxury cars, air-conditioned malls.  
**Ottoman (1300–1922):** Fez hats, hammams, bazaars, minarets, ornate tile work, coffee houses.  
**Classical Islamic (700–1300):** Geometric architecture, arabesque patterns, caravanserais, scholars with astrolabes, calligraphy, no figurative art in religious spaces.  

### CHINESE CULTURES

**Contemporary:** Modern Beijing/Shanghai, neon signs, Mandarin text, high-speed trains.  
**Imperial (Qing 1644–1912):** Dragon robes, palanquins, bound feet (women), Forbidden City aesthetic.  
**Tang/Song dynasty (600–1200):** Tang tricolor glazed pottery, silk robes, pagodas, canal boats.  

---

## SECTION 4 — WHERE LOCKS GET INJECTED

Every route that generates an image MUST receive and use both locks.

### 4A. Scene Image Route — `app/api/hybrid/scene-image/route.ts`

**Current behavior:** Builds prompt from scene description + character descriptions. No era/culture lock.

**Required change:**
```
Inject at the START of the positive prompt (before everything else):
[ERA LOCK: {eraPositive}]
[CULTURE LOCK: {culturePositive}]

Inject into the negative prompt (appended to existing negative):
, {eraNegative}
```

**Priority:** ERA LOCK and CULTURE LOCK override everything. If the image model generates something from the wrong era, it is a system failure.

### 4B. Scene Plan Route — `app/api/hybrid/scene-plan/route.ts`

**Current behavior:** LLM writes scene descriptions with no era/culture context.

**Required change:**  
Add to the LLM system prompt:
```
ERA CONTEXT: This story is set in [era]. Every scene description MUST reflect the visual reality of that era. Do NOT include any element that did not exist in that era. If the era is 899 AD, do not mention or imply phones, cars, electricity, or modern clothing. If the era is 2024, do not imply horses as transport or torches as lighting.

CULTURE CONTEXT: This story belongs to [culture]. Every scene description MUST use culturally accurate clothing, architecture, names, food, and environment for that culture.
```

### 4C. Story Expand Route — `app/api/hybrid/story-expand/route.ts`

**Required change:**  
Add era + culture as parameters. The LLM writing the expanded story must stay within the bounds of the era/culture. It must not write "she grabbed her phone" if the story is set in 899 AD.

### 4D. Character Portrait Generation

**In all 3 planners (hybrid / children / movie):**  
When generating a character portrait, inject the era lock into the character image prompt. A character in a story set in 1819 should be dressed in 1819 clothing, not 2025 fashion.

---

## SECTION 5 — WHAT THE USER SEES (UI)

### 5A. Story Tab — New Fields (All 3 Planners)

Add two new fields to the Story tab below the Story Genre / Tone fields:

**Field 1: Story Era / Year**  
- Type: text input  
- Placeholder: `"e.g. 2024, 1819, 899 AD, Ancient 300 BC, Today"`  
- State variable: `storyEra` (string)  
- Stored in project save/load  
- Help text: "Sets the time period for ALL scene images. If your story is set in 1819, all images will look like 1819."  

**Field 2: Story Culture / Setting**  
- Type: text input  
- Placeholder: `"e.g. Contemporary Lagos, Victorian England, Yoruba Kingdom, Medieval France"`  
- State variable: `storyCulture` (string)  
- Stored in project save/load  
- Prepopulates from Art Style picker (Nollywood → "Contemporary Nigerian / Lagos")  
- Help text: "Sets the cultural world for ALL scene images."  

**Era Badge:** Show on the scene board header alongside the style badge. Example: `1819 · Victorian` or `2024 · Lagos`.

### 5B. Scene Board — Era Warning

If `storyEra` is empty when the user tries to generate scene images, show a warning:  
`"No story era set. Images may not match your story's time period. Set Era in Story tab."`  
(Non-blocking warning — user can dismiss and proceed.)

### 5C. Scene Card — Era Override (Optional, Phase 2)

Each scene card could optionally override the era for that specific scene. Example: a flashback scene in a 2024 story might be set in 1960. This is Phase 2 — not required for launch.

---

## SECTION 6 — THE NEW UTILITY FILE

**File:** `src/lib/era-culture-lock.ts`

**Exports:**
```typescript
function parseEraYear(input: string): number | null
// "2024" → 2024, "899 AD" → 899, "300 BC" → -300, "today" → current year

function getEraBucket(year: number): EraBucket
// Maps year to one of the era categories in Section 2

function buildEraLock(year: number | null, culture: string): {
  positive: string;   // injected into prompt
  negative: string;   // injected into negative prompt
  label: string;      // shown in UI badge, e.g. "Early Medieval (899 AD)"
}

function buildCultureLock(culture: string, era: string): {
  positive: string;
  label: string;
}

// The combined call used by all routes:
function buildFullEraLock(storyEra: string, storyCulture: string): {
  positive: string;
  negative: string;
  label: string;
}
```

---

## SECTION 7 — COMPLETE PROMPT INJECTION FORMAT

Every scene image prompt MUST follow this structure after this system is built:

```
[ERA: {era.label}] [CULTURE: {culture.label}]

{era.positive}

{culture.positive}

CHARACTER {name} — EXACT APPEARANCE: {visualDescription} AGE LOCK: {ageLock}

SCENE: {sceneDescription — stripped of action verbs, converted to static frame}

CAMERA: {cameraDirection}

STYLE: {stylePreset.prefix}

---NEGATIVE: {stylePreset.negative}, {era.negative}
```

**The order matters.** Era and culture come FIRST. The image model reads the prompt top to bottom. If era comes first, it frames everything that follows. If it comes last, the model may ignore it.

---

## SECTION 8 — SCENE DESCRIPTION TO STATIC FRAME CONVERSION

**Problem:** Scene descriptions are narrative ("The twins run from the rising flood"). Image models generate action shots from this — blurry motion, chaos, cave-man drama.

**Solution:** Add a conversion step in `scene-image/route.ts` that strips action language and converts to a static cinematic frame description before passing to the image model.

**Rules for frame conversion:**
- Remove: running, fleeing, fighting, crying, screaming, exploding, attacking
- Replace with: standing tense, looking toward camera, expression of fear/joy/etc.
- Keep: setting, lighting, clothing, background, mood, characters present
- Add: "cinematic still frame, single moment frozen in time, no motion blur"

**Example:**  
BEFORE: "The twins slip away from the market stall as Mama Iyabo searches frantically"  
AFTER: "Two young children standing at the edge of a busy Lagos market stall, afternoon light, concerned expressions. Mama Iyabo visible in the background searching. Cinematic still frame."

---

## SECTION 9 — GALLERY LAYOUT FIX (Image #56 issue)

**Problem:** The 3-shot portrait gallery thumbnails appear inside the button row flex container, making the UI cramped and broken.

**Fix:** The gallery `<div>` must be placed OUTSIDE the button row wrapper. It must sit on its own row BELOW all buttons with:
- `style={{ width: "100%", marginTop: 10 }}` on the outer wrapper
- Clear heading: "Full body shots — click to set as main"
- Thumbnails: 64×96px, gap 8px, border-radius 8px
- MAIN badge below the active shot in lilac/purple
- NOT inside any flex row that contains buttons

**Applies to:** hybrid-planner, children-planner, movie-planner character sections.

---

## SECTION 10 — BUILD ORDER

Build in this exact sequence. Do not skip steps.

| Step | Task | File(s) |
|------|------|---------|
| 1 | Fix gallery layout (move outside button row) | hybrid/children/movie planner page.tsx |
| 2 | Create `era-culture-lock.ts` utility with full era map | `src/lib/era-culture-lock.ts` |
| 3 | Add `storyEra` + `storyCulture` fields to hybrid planner Story tab | `hybrid-planner/page.tsx` |
| 4 | Wire era/culture lock into scene-image route | `api/hybrid/scene-image/route.ts` |
| 5 | Wire era/culture context into scene-plan route | `api/hybrid/scene-plan/route.ts` |
| 6 | Wire era/culture context into story-expand route | `api/hybrid/story-expand/route.ts` |
| 7 | Add scene description → static frame conversion in scene-image route | `api/hybrid/scene-image/route.ts` |
| 8 | Propagate `storyEra` + `storyCulture` to children-planner | `children-planner/page.tsx` |
| 9 | Propagate `storyEra` + `storyCulture` to movie-planner | `movie-planner/page.tsx` |
| 10 | Add era badge to scene board header | all 3 planners |
| 11 | Wire era lock into character portrait generation | all 3 planners |
| 12 | Test: Nigeria 2024 → modern Lagos images | browser test |
| 13 | Test: Nigeria 899 AD → Yoruba Kingdom images | browser test |
| 14 | Test: England 1819 → Regency England images | browser test |
| 15 | Test: Europe 300 BC → Classical Ancient images | browser test |

---

## SECTION 11 — WHAT MUST NEVER HAPPEN AGAIN

| Story Setting | WRONG output | CORRECT output |
|---------------|-------------|----------------|
| Nigeria 2024 | Tribal cavemen, jungle, primitive | Lagos streets, Ankara fashion, contemporary |
| Nigeria 899 AD | Modern people with phones | Yoruba royal courts, beaded crowns, mud-brick palaces |
| England 1819 | Jeans and smartphones | Empire-line dresses, horse carriages, candlelit rooms |
| Europe 1690 | T-shirts and SUVs | Powdered wigs, flintlock pistols, baroque architecture |
| Any era | Action shots / motion blur | Cinematic still frame, frozen moment |
| Any era | Characters from wrong era | Characters dressed 100% accurately for their era + culture |

---

## SECTION 12 — CRITICAL RULES FOR THE DEVELOPER / AGENT BUILDING THIS

1. **Era lock must come FIRST in the prompt.** Not last. Not middle. First.
2. **Negative prompt era blocker is NOT optional.** It actively prevents drift. Without it, the model ignores the era lock.
3. **Never trust the model to infer era from story text alone.** It will always guess wrong. The lock must be explicit.
4. **Scene description must be converted to a static frame before it hits the image model.** Action language in scene descriptions = action chaos in output.
5. **Era + culture must be saved with the project.** If user closes and reopens the project, the locks must still be there.
6. **Era badge on scene board is mandatory.** The user must always see what era lock is active so they know why images look a certain way.
7. **If `storyEra` is empty, use "contemporary modern" as the default, not nothing.** No era = model guesses = cavemen.
8. **Culture and era interact.** "Nigeria + 2024" is different from "England + 2024". Do not apply era lock without culture context.

---

*This document is the single source of truth for the Era + Culture Lock system.*  
*Do not build this feature without reading every section.*  
*Do not consider this feature complete until all 15 steps in Section 10 are done and all 4 browser tests in Section 10 pass.*
