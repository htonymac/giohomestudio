# GioHomeStudio — Design Handoff

This folder contains everything needed to apply the **v14 dark/purple-orange** design system to the rest of the app.

## Files

| File | Purpose |
|---|---|
| `00-design-system.md` | **Start here.** Tokens, component rules, swap list, motion rules, rules about what does NOT exist. |
| `_prompt-for-claude-code.md` | Copy-paste prompt to give Claude Code to roll this design across every page. |
| `lib/designSystem.ts` | TypeScript tokens object. Import and use instead of hardcoding colors. |
| `lib/animations.css` | Keyframes + helper classes (`.is-sweep`, `.is-rise`, etc). |
| `01-dashboard.md` … `05-asset-library.md` | Per-page notes (legacy; may reference v9 — treat `00-design-system.md` and `GioHomeStudio Dashboard v14.html` as canonical). |

## Reference implementation

Open `/GioHomeStudio Dashboard v14.html` in a browser. This is the living reference. If anything in these docs disagrees with that file, the file wins.

## How to use with Claude Code

1. Zip the project (or push to a git repo Claude Code can access).
2. Open Claude Code and point it at the project.
3. Paste the prompt from `_prompt-for-claude-code.md`.
4. Walk it page by page.
