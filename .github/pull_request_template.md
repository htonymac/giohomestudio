## What changed

## Why

## Critical-area review (confirm each)
- [ ] Story/prompt generation logic correct
- [ ] Scene timing & prompt demarcation correct
- [ ] Video/music assembly flow correct
- [ ] File upload & storage handling safe
- [ ] Generated-media deletion guarded
- [ ] User data separation correct
- [ ] Job queue failures handled
- [ ] Retry handling correct
- [ ] AI/video generation cost-control in place
- [ ] No API key / secret exposure
- [ ] Payment/credit logic correct (if touched)
- [ ] Admin permissions correct
- [ ] No unguarded destructive DB action
- [ ] No large-file / performance regressions

## Merge gates
- [ ] Sourcery run + all CRITICAL fixed
- [ ] Staging link / test build / sample output provided
- [ ] Henry reviewed sample output (required for generation/storage/deletion/payment/API-key changes)
