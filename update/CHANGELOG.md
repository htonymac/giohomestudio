# GioHomeStudio — CHANGELOG

## 2026-04-30 S1

### fix: children-planner character DB persistence (BUG-03)
- **What:** Added POST to `/api/character-voices` at `extractChildCharacters` and `expandStory` setSavedChars call sites
- **Why:** Characters were stored in React state only — lost on page reload or across sessions
- **Impact:** Characters now persist to DB immediately on creation. CharacterPicker reads from DB. Mount load already existed.
- **Risk:** Low — 409 (duplicate) handled gracefully; local state retained on POST failure

### fix: ElevenLabs TTS silent catch → surfaced error (prep BUG-09)
- **What:** Replaced empty `catch { /* ElevenLabs failed */ }` with `console.error` + structured error message. Added `!res.ok` check that reads error body from ElevenLabs API response.
- **Why:** Silent swallow hid all ElevenLabs failures — impossible to debug TTS fallback chain
- **Impact:** Errors now visible in server logs. Fallback chain preserved (error logged, then falls through to SAPI/FFmpeg tier).
- **Risk:** None — fallback chain unchanged, error now observable

### fix: karaoke stderr truncation removed, stdout JSON non-greedy (prep BUG-08)
- **What:** Removed `.slice(0, 500)` from stderr in error message. Changed stdout JSON regex from `/\{[\s\S]*\}/` (greedy) to `/\{[\s\S]*?\}\s*$/m` (non-greedy, last match).
- **Why:** Truncated stderr hid root cause of Python analysis failures. Greedy regex matched first `{` to last `}` which could include debug output before the real JSON result.
- **Impact:** Full stderr in error messages. Correct JSON extracted even when Python prints debug lines before the result object.
- **Risk:** Low — regex change is conservative; anchored to end of output

### docs: added MUBERT_PAT to .env.example
- **What:** Added `MUBERT_PAT=your_mubert_pat_here` with comment to `.env.example`
- **Why:** Mubert is required for instrumental tracks >47s. Key was undocumented.
- **Impact:** Developers know to configure it. No runtime change.
- **Risk:** None
