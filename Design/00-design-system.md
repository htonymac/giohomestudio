# GioHomeStudio — Design System (v14)

> **Source of truth:** `GioHomeStudio Dashboard v14.html` in the project root. Open it in a browser for a living reference. This document supersedes any earlier handoff notes; the v9 "light paper" system is dead — v14 is **dark, crisp, purple→orange**.

---

## 1. Design principles (apply to EVERY page)

1. **Crisp, not foggy.** No `backdrop-filter`, no glass, no smoke, no blur, no gradient-washed card surfaces. Cards sit on solid `#151518` with a hairline `rgba(255,255,255,.06)` border.
2. **Dark-first.** Background `#0e0e10` (app) / `#0b0b0d` (sidebar). White ink (`#fff`) on near-black; no off-whites.
3. **Purple → orange is the one hero gradient.** `#a78bfa → #d17bff → #ff9a3c → #f5a623`. Used on primary CTAs (animated sweep) and brand accents only. Never on card backgrounds.
4. **Motion is tactile, not ambient.** Buttons/tiles lift on hover, punch down on press (`scale(.96)` + `translateY(1px)` with 80ms transition). No floating blobs, no ambient mesh, no scanning lights on idle surfaces.
5. **No emoji** anywhere except as placeholders the user is explicitly meant to replace. Use stroke SVG icons (`stroke-width:1.9`, `fill:none`, `stroke-linecap:round`).
6. **Density:** 14px body, 10–11px uppercase tracked labels for meta, 40–68px serif italic for hero display. Numbers are never smaller than 14px.

---

## 2. Tokens

### Colors

```css
:root{
  /* surfaces */
  --paper:      #0e0e10;              /* app background */
  --sidebar:    #0b0b0d;              /* sidebar only */
  --card:       #151518;              /* all cards, stats, panels, tools */
  --alert:      #1a1a1e;              /* elevated alert bar */
  --wallet:     #0f0f11;              /* wallet inner fill */

  /* lines */
  --line:       rgba(255,255,255,.06);
  --line-2:     rgba(255,255,255,.12);

  /* ink */
  --ink:        #ffffff;
  --ink-2:      #c5c5c8;
  --mute:       #7b7b80;
  --mute-2:     #55555a;

  /* the gradient — purple → magenta → orange → amber */
  --btn-a:      #a78bfa;
  --btn-b:      #d17bff;
  --btn-c:      #ff9a3c;
  --btn-d:      #f5a623;

  /* accents (per-item icon tile tints) */
  --lilac:      #a78bfa;
  --sky:        #7cc4ff;
  --magenta:    #d17bff;
  --pink:       #ff7ab8;
  --mint:       #7ae0c3;
  --gold:       #ffb347;
  --coral:      #ff7a45;
  --blue:       #7aa0c4;
}
```

### Typography

```css
--sans:  'Geist',system-ui,sans-serif;        /* body, labels, buttons */
--serif: 'Instrument Serif',Georgia,serif;    /* hero display <em> only */
--mono:  'JetBrains Mono',monospace;           /* micro-labels, counts, tracking */
```

Google Fonts import (put in `<head>`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

Scale:

| Use | Size | Weight | Family | Notes |
|---|---|---|---|---|
| Hero display | `clamp(40px,5.4vw,68px)` | 900 | sans | `line-height:0.94; letter-spacing:-.045em` |
| Hero display `<em>` | same | 400 | **serif italic** | purple→orange gradient text, animated sweep |
| H2 panel title | 16px | 800 | sans | `letter-spacing:-.01em` |
| Body | 14px | 500 | sans | `var(--ink-2)` |
| Micro-label | 10–11px | 700 | **mono** | `letter-spacing:.18–.24em; text-transform:uppercase` |
| Number / stat value | 28–32px | 900 | sans | tabular nums |

### Radii / shadow / ease

```css
--r-xs:8px; --r-sm:10px; --r-md:14px; --r-lg:18px; --r-xl:22px; --r-pill:999px;

--sh-lift:  0 8px 20px -6px rgba(167,139,250,.35);
--sh-pop:   0 12px 28px -8px rgba(209,123,255,.55);
--sh-glow:  0 10px 22px -6px rgba(209,123,255,.5);

--e-soft:   cubic-bezier(.22,.61,.36,1);
--e-bounce: cubic-bezier(.34,1.56,.64,1);
```

---

## 3. Component rules

### 3.1 Buttons (primary)

The hero CTA, Top Up, Roll, Alert Go, Review — all share ONE look:

```css
.btn-primary{
  background:linear-gradient(120deg,var(--btn-a),var(--btn-b),var(--btn-c),var(--btn-d),var(--btn-a));
  background-size:300% 100%;
  animation:btnSweep 6s linear infinite;
  color:#fff; border:none; border-radius:12px;
  padding:10px 18px; font-weight:700;
  position:relative; overflow:hidden;
  transition:transform .18s var(--e-soft), box-shadow .2s;
}
.btn-primary::before{ /* white shine on hover */
  content:""; position:absolute; inset:0;
  background:linear-gradient(100deg,transparent 35%,rgba(255,255,255,.55) 50%,transparent 65%);
  transform:translateX(-120%) skewX(-18deg);
  transition:transform .7s cubic-bezier(.22,.61,.36,1);
}
.btn-primary:hover{ transform:translateY(-2px) scale(1.02); box-shadow:var(--sh-pop); }
.btn-primary:hover::before{ transform:translateX(120%) skewX(-18deg); }
.btn-primary:active{ transform:translateY(1px) scale(.96); transition-duration:.08s; }

@keyframes btnSweep{ 0%{background-position:0% 50%} 100%{background-position:300% 50%} }
```

### 3.2 Buttons (secondary / tile)

Card-like rectangles (Quick Start items, tool cards):

```css
.btn-tile{
  background:#151518;
  border:1px solid rgba(167,139,250,.22);
  border-radius:14px;
  padding:14px;
  transition:transform .18s var(--e-soft), border-color .18s, box-shadow .2s;
}
.btn-tile:hover{
  transform:translateX(4px) translateY(-1px);
  border-color:rgba(167,139,250,.5);
  box-shadow:var(--sh-lift);
}
.btn-tile:active{ transform:translateX(2px) translateY(1px) scale(.97); transition-duration:.08s; }
```

### 3.3 Sidebar nav items

```css
.nav-item{
  display:flex; align-items:center; gap:10px;
  padding:7px 10px; margin:1px 0;
  border-radius:10px; color:var(--ink-2);
  position:relative; transition:transform .2s var(--e-soft), background .2s;
}
.nav-item:hover{ background:rgba(167,139,250,.08); color:#fff; transform:translateX(4px); }
.nav-item.active{ background:rgba(167,139,250,.1); color:#fff; font-weight:700; }
.nav-item.active::before{
  content:""; position:absolute; left:-14px; top:8px; bottom:8px; width:3px;
  background:linear-gradient(180deg,var(--btn-a),var(--btn-c));
  border-radius:0 3px 3px 0;
}

/* 26×26 icon tile — gradient, one of 11 per-item tints */
.nav-item .ic{
  width:26px; height:26px; border-radius:8px;
  display:grid; place-items:center; color:#fff;
  background:linear-gradient(135deg,var(--btn-a),#7c6ff5);
  box-shadow:0 3px 8px -2px rgba(167,139,250,.5);
  transition:transform .25s var(--e-bounce), box-shadow .2s;
}
.nav-item:hover .ic{ transform:rotate(-8deg) scale(1.12); box-shadow:0 6px 14px -2px rgba(167,139,250,.6); }
.nav-item:active .ic{ transform:rotate(0) scale(.92); transition-duration:.08s; }

.nav-item .ic svg{
  width:13px; height:13px; stroke:currentColor;
  stroke-width:1.9; fill:none;
  stroke-linecap:round; stroke-linejoin:round;
}

/* Per-item tints (c2–c11) — cycle across nav list for visual variety */
.nav-item.c2  .ic{ background:linear-gradient(135deg,#7cc4ff,#a78bfa) }
.nav-item.c3  .ic{ background:linear-gradient(135deg,#d17bff,#ff7ab8) }
.nav-item.c4  .ic{ background:linear-gradient(135deg,#7ae0c3,#7cc4ff) }
.nav-item.c5  .ic{ background:linear-gradient(135deg,#ffb347,#ff7a45) }
.nav-item.c6  .ic{ background:linear-gradient(135deg,#c9a9ff,#ff7ab8) }
.nav-item.c7  .ic{ background:linear-gradient(135deg,#ff9a3c,#d17bff) }
.nav-item.c8  .ic{ background:linear-gradient(135deg,#7ae0c3,#a78bfa) }
.nav-item.c9  .ic{ background:linear-gradient(135deg,#7cc4ff,#c9a9ff) }
.nav-item.c10 .ic{ background:linear-gradient(135deg,#ffb347,#ff7ab8) }
.nav-item.c11 .ic{ background:linear-gradient(135deg,#a78bfa,#ff9a3c) }
.nav-item.active .ic{ background:linear-gradient(135deg,#a78bfa,#ff9a3c) }
```

### 3.4 Cards / panels / tools / stats

All share the same base:

```css
.card{
  background:#151518;
  border:1px solid var(--line);
  border-radius:18px;
  padding:18px;
}
```

- **NO** `backdrop-filter`
- **NO** gradient backgrounds on the card itself
- **NO** inner white/purple wash
- Color lives in icon tiles, gradient text on numbers, and the animated CTA. The card itself stays flat `#151518`.

### 3.5 Hero title (serif `<em>` with animated sweep)

```css
.h1{ font-weight:900; font-size:clamp(40px,5.4vw,68px); line-height:.94; letter-spacing:-.045em; }
.h1 em{
  font-family:var(--serif); font-style:italic; font-weight:400;
  background:linear-gradient(100deg,var(--btn-a),var(--btn-b),var(--btn-c),var(--btn-d),var(--btn-a));
  background-size:300% 100%;
  -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent; color:transparent;
  animation:btnSweep 6s linear infinite;
}
.h1 em::after{ /* blinking caret */
  content:""; display:inline-block; width:4px; height:.8em;
  background:linear-gradient(180deg,var(--btn-a),var(--btn-c));
  margin-left:6px; vertical-align:-2px;
  animation:typeCursor 1s steps(2) infinite;
}
@keyframes typeCursor{ 50%{opacity:0} }
```

### 3.6 Brand dot (logo)

```css
.brand-dot{
  width:40px; height:40px; border-radius:13px;
  background:conic-gradient(from 0deg,#a78bfa,#7cc4ff,#d17bff,#5b4fe0,#a78bfa);
  box-shadow:0 0 0 3px rgba(167,139,250,.18),0 10px 24px -8px rgba(91,79,224,.5);
  animation:spin 9s linear infinite;
}
@keyframes spin{ to{ transform:rotate(360deg) } }
```

### 3.7 Wallet card (sidebar bottom)

```css
.wallet{
  background:linear-gradient(135deg,rgba(167,139,250,.18),rgba(255,154,60,.12));
  border:1px solid rgba(167,139,250,.35);
  border-radius:16px;
  padding:14px;
}
.wallet .top-up{ /* uses .btn-primary */ }
```

---

## 4. Swap list — what to REPLACE on existing pages

Use this checklist when applying the system to any page Claude Code encounters:

| ❌ Replace | ✅ With |
|---|---|
| Yellow/amber CTAs (`#f5a623` solid) | `.btn-primary` animated gradient |
| Green "Assemble / Save" buttons | `.btn-primary` |
| Emoji in headings, labels, buttons | stroke SVG icons from the icon set |
| Multi-color step pills (purple + yellow + green + blue circles) | single muted pill, active one gets the purple→orange gradient |
| White card backgrounds / light theme | `#151518` dark cards |
| `backdrop-filter: blur()` on any surface | **remove entirely** |
| Purple-tinted glass sidebars | solid `#0b0b0d` sidebar |
| Soft drop shadows with warm tones | `var(--sh-lift)` / `--sh-pop` (purple-biased) |
| Colorful tab underlines | single purple→orange 2px bar under active tab |
| "Online" pill in mint green | `.pill-live` — `#151518` bg, `#7ae0c3` dot, white text |

---

## 5. Motion rules

- **Button hover:** `translateY(-2px) scale(1.02)` + stronger shadow + white shine wipe
- **Button press:** `translateY(1px) scale(.96)` with `.08s` transition
- **Nav item hover:** slide right 4px + icon tile rotates −8° and scales 1.12
- **Nav item press:** tile snaps to 0° + scales to .92
- **Continuous animations ONLY on:** the purple→orange gradient sweep (6s), the brand dot spin (9s), the hero caret (1s blink). Nothing else loops by default.
- **Page entrance:** `rise .55–.65s var(--e-soft) both`, staggered 60ms per main child.

---

## 6. What does NOT exist in this system

- No gradient card backgrounds
- No glass/blur effects
- No ambient floating blobs
- No grid overlay on content area
- No light-mode variant
- No warm paper tones
- No emoji as UI
- No rounded-left-border-accent info boxes
