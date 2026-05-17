# GHS — Daily Git Push Log

Format: `[TIME] COMMIT — DESCRIPTION`
Updated every push. Use this to roll back to any point in the day.

---

## 2026-05-16

| Time (UTC-7) | Commit | Description |
|---|---|---|
| 08:59 | `24c8e2b` | fix(qc): re-run uses current scene descriptions not frozen expandedSummary |
| 09:09 | `acfa93f` | fix(pipeline): music sceneId mismatch, SFX LLM role, assembly error surface |
| 09:37 | `b8fffc7` | feat(ghs): establishing shot image gen + assembly wire-in, modal scroll-lock, voice Cast Bible wiring |
| 09:38 | `8f33f67` | fix(tsc): remove redundant != none check on subtitleStyle (type has no overlap) |
| 19:33 | `84a0c9c` | Session 13: Subtitle system overhaul + image URL fix + intro/outro persistence |
| 19:33 | `886c61f` | docs: update HANDOFF.md — Session 13 state + next session queue |
| 19:46 | `7f4ffbf` | fix: Context Check/Fix buttons + subtitle match checker (broken API call replaced) |
| 19:47 | `731be32` | docs: update HANDOFF.md — session 14 complete |

---

## HOW TO ROLL BACK TO ANY PUSH

```
git log --oneline          # see all commits
git checkout <COMMIT>      # view that state
git revert <COMMIT>        # undo one commit safely
git reset --hard <COMMIT>  # go back to that point (loses later commits)
```

Safe rollback = `git revert`. Hard rollback = `git reset --hard` (use only when sure).

---

## 2026-05-15

| Time (UTC-7) | Commit | Description |
|---|---|---|
| 22:21 | `f63b86b` | chore: add landscape shot spec, db fix scripts, story structure docs |
| 22:21 | `973b03f` | fix(assembly): full pipeline recovery — narration, sceneId, beat images, gradient fallback |
| 22:39 | `9d0c879` | feat: collab editor 3-panel shots, apply-edit route, subtitle tokens, modal scroll-lock, establishing shot generate, Wave C multi-image |
| 22:40 | `3707d19` | docs: update CHANGELOG + HANDOFF for Session 11 |

---

## 2026-05-14

| Time (UTC-7) | Commit | Description |
|---|---|---|
| 12:27 | `662fd79` | feat: session 8/9 — ProjectSettings migration + audio pipeline + wave fixes |
| 12:32 | `61a8cd4` | Phase 2-A/B/C: imageFlipSeconds + per-scene flip UI + auto-expand assembly |
| 12:40 | `c91c0f4` | Phase 2-C/D: auto-expand preview update + image sufficiency pre-flight check |
| 12:41 | `f0d48dd` | Phase 2-F: replace subtitles= (libass) with drawtext subtitle filter |
| 12:46 | `8c1b853` | docs: update CHANGELOG for Phase 1-2 hybrid planner fixes |
| 14:48 | `2d554d5` | Implement phases 3-A/B/C/D, 4-A/B/C, 5-B/C: scene image enhancements |
