# PR workflow (locked 2026-06-05)

Direct push to `main` is BLOCKED. Every change ships through a PR. This applies to maintainers and admins — no exceptions.

## Why

This repo runs a public site (andiostudio.com). Direct pushes meant a typo could ship to every user instantly. With branch protection + Sourcery automated review, bad code is caught before it lands.

## The flow

```
local fix
  ↓
git checkout -b <type>/<short-desc>
  ↓
edit + commit
  ↓
git push origin <branch>
  ↓
gh pr create  (uses .github/pull_request_template.md)
  ↓
Sourcery reviews automatically — surfaces CRITICAL / HIGH / MEDIUM / LOW issues
  ↓
fix every CRITICAL → push more commits to the branch
  ↓
get 1 approval (maintainer)
  ↓
resolve all PR conversations
  ↓
merge (squash recommended)
  ↓
auto-CD deploys (push to main triggers deploy-prod.yml on tag, deploy-staging.yml on push to staging)
```

## Branch naming

Use a 2-segment prefix so PRs are scannable:

| Prefix | When | Example |
|---|---|---|
| `feat/` | new user-facing capability | `feat/voice-tone-picker` |
| `fix/` | bug fix | `fix/subtitle-word-sync` |
| `chore/` | tooling, repo hygiene, deps | `chore/upgrade-prisma` |
| `docs/` | docs only | `docs/dev-onboarding` |
| `refactor/` | code restructuring, no behaviour change | `refactor/children-planner-tabs` |
| `test/` | tests only | `test/playwright-narration-battery` |

## Critical-area review checklist

Every PR template ships with 14 critical-area checkboxes. Tick the ones your change affects; mark the rest "no change". The 14 areas:

1. Story/prompt generation logic
2. Scene timing & prompt demarcation
3. Video/music assembly flow
4. File upload & storage handling
5. Generated-media deletion
6. User data separation
7. Job queue failures
8. Retry handling
9. AI/video generation cost-control
10. API key / secret exposure
11. Payment/credit logic
12. Admin permissions
13. Destructive DB actions
14. Large-file / performance

## Merge gates

A PR cannot merge until ALL of:

- [ ] Sourcery has reviewed AND every CRITICAL issue is fixed (HIGH/MEDIUM allowed if explained in a comment)
- [ ] The PR includes a staging link, test build, OR sample generated output (when the change affects app output)
- [ ] 1 maintainer approval AFTER the last push
- [ ] All PR conversations resolved
- [ ] No force-push has been used (force-push is blocked)

## Special-case rule

Changes touching ANY of these REQUIRE the maintainer to review a sample output before merge:

- Generation (story-expand, scene-plan, character-extract, image gen, video gen, narration)
- Storage (R2, local FS, asset upload/delete)
- Deletion (any DROP, DELETE, or rm operation)
- Payment / credits
- API keys / secrets

For these, attach a generated sample to the PR description so the maintainer can verify the output is correct.

## Force-push and direct push are blocked

The protection rule blocks:

- `git push origin main` (direct push)
- `git push --force origin main` (force-push)
- `git push origin :main` (branch deletion)

`enforce_admins: true` means even repo admins get blocked. The only way changes land is through the PR flow above.

## Sourcery integration

Sourcery auto-reviews every new PR. To trigger a re-review after pushing more commits, comment `@sourcery-ai review` on the PR.

The Sourcery API key lives in the GHS server `.env` as `SOURCERY_API_KEY=…`. It is NEVER committed.

## When CI is green and Sourcery is clean

```
gh pr merge <PR-number> --squash --delete-branch
```

`--squash` keeps the main history clean (one commit per PR). `--delete-branch` removes the feature branch after merge.
