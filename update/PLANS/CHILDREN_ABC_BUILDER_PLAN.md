# Children Planner — ABC Builder (locked 2026-06-15)

Henry wants an A-is-for-Apple flashcard builder in the **Children planner** (NOT Hybrid —
"child has its own pattern"). Build ADDITIVE; do not break existing children learning modes.

## Locked decisions (Henry, 2026-06-15)
- **Card layout = Letter + picture + word.** Each scene: big letter "A a" (upper+lower),
  a picture of the word's object (apple), the word "apple" spelled under it. Narrator: "A is for Apple."
- **Selection = pick letters + auto words.** User ticks letters (A,B,C…); app auto-assigns a
  kid-friendly word per letter (A=apple, B=ball…), each swappable. One scene per selected letter.
- **Gen Max per letter** — several image options per letter; keep the best (reuse children Gen Max).
- **Lives in Children planner only.** Upgrade the existing ABC Learning mode.

## Why text must be code-drawn
Diffusion models spell badly. So: generate a CLEAN image of the object (apple) via the normal
pipeline, then COMPOSITE the letter + word as crisp text (Sharp/SVG, like the existing
wordOverlay / generate-card). Perfect spelling guaranteed, every time.

## Auto word map (kid-friendly, concrete, easy to image)
A=apple B=ball C=cat D=dog E=egg F=fish G=goat H=hat I=igloo J=juice K=kite L=lion
M=moon N=nest O=orange P=pig Q=queen R=rabbit S=sun T=tree U=umbrella V=van W=watch
X=box(x-ray? use "box") Y=yo-yo Z=zebra  (all swappable)

## Build slices
1. **Flashcard overlay** (server): extend wordOverlay → draw big letter band (top) + word (bottom)
   on the generated object image. Verifiable via curl + image read.
2. **Auto word map + per-letter scene builder** (children-planner): letter grid (tick), auto-word
   (editable), "Generate ABC scenes" → one scene per letter {title:"A is for Apple", teachWord, letter, object desc}.
3. **Image gen per scene** with the flashcard overlay + Gen Max options.
4. **Narration**: "A is for Apple. A. Apple." per scene; phonics voice.
5. Keep existing ABC Learning / phonics / word modes working (additive).

## Guardrails
- Additive only. Don't change existing children learning patterns.
- Object image prompt: single object, clean simple background, bright children's illustration,
  no text in the image itself (text is composited).
