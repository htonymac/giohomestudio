// GioHomeStudio design tokens — v14 (dark, crisp, purple→orange)
// Source of truth: /GioHomeStudio Dashboard v14.html

export const ds = {
  color: {
    paper:   '#0e0e10',
    sidebar: '#0b0b0d',
    card:    '#151518',
    alert:   '#1a1a1e',
    wallet:  '#0f0f11',

    line:    'rgba(255,255,255,0.06)',
    line2:   'rgba(255,255,255,0.12)',

    ink:     '#ffffff',
    ink2:    '#c5c5c8',
    mute:    '#7b7b80',
    mute2:   '#55555a',

    // hero gradient stops
    btnA: '#a78bfa', // purple
    btnB: '#d17bff', // magenta
    btnC: '#ff9a3c', // orange
    btnD: '#f5a623', // amber

    // accents for icon-tile tints
    lilac:   '#a78bfa',
    sky:     '#7cc4ff',
    magenta: '#d17bff',
    pink:    '#ff7ab8',
    mint:    '#7ae0c3',
    gold:    '#ffb347',
    coral:   '#ff7a45',
    blue:    '#7aa0c4',
  },

  grad: {
    // the one hero gradient — use for primary CTAs, hero <em>, active accents
    hero:     'linear-gradient(120deg,#a78bfa,#d17bff,#ff9a3c,#f5a623,#a78bfa)',
    heroSize: '300% 100%',
    // sidebar per-item icon tile tints (c2..c11)
    tile: {
      c2:  'linear-gradient(135deg,#7cc4ff,#a78bfa)',
      c3:  'linear-gradient(135deg,#d17bff,#ff7ab8)',
      c4:  'linear-gradient(135deg,#7ae0c3,#7cc4ff)',
      c5:  'linear-gradient(135deg,#ffb347,#ff7a45)',
      c6:  'linear-gradient(135deg,#c9a9ff,#ff7ab8)',
      c7:  'linear-gradient(135deg,#ff9a3c,#d17bff)',
      c8:  'linear-gradient(135deg,#7ae0c3,#a78bfa)',
      c9:  'linear-gradient(135deg,#7cc4ff,#c9a9ff)',
      c10: 'linear-gradient(135deg,#ffb347,#ff7ab8)',
      c11: 'linear-gradient(135deg,#a78bfa,#ff9a3c)',
      active: 'linear-gradient(135deg,#a78bfa,#ff9a3c)',
    },
    brandDot: 'conic-gradient(from 0deg,#a78bfa,#7cc4ff,#d17bff,#5b4fe0,#a78bfa)',
  },

  radius: { xs: 8, sm: 10, md: 14, lg: 18, xl: 22, pill: 999 },

  shadow: {
    lift: '0 8px 20px -6px rgba(167,139,250,.35)',
    pop:  '0 12px 28px -8px rgba(209,123,255,.55)',
    glow: '0 10px 22px -6px rgba(209,123,255,.5)',
    tile: '0 3px 8px -2px rgba(167,139,250,.5)',
  },

  font: {
    sans:  "'Geist', system-ui, sans-serif",       // UI, body
    serif: "'Instrument Serif', Georgia, serif",   // hero <em> italic only
    mono:  "'JetBrains Mono', monospace",          // micro-labels, counts
  },

  ease: {
    soft:   'cubic-bezier(.22,.61,.36,1)',
    bounce: 'cubic-bezier(.34,1.56,.64,1)',
  },

  motion: {
    btnHover:  { transform: 'translateY(-2px) scale(1.02)', transition: '.18s' },
    btnActive: { transform: 'translateY(1px) scale(.96)',   transition: '.08s' },
    navHover:  { transform: 'translateX(4px)',              transition: '.2s'  },
    tileHover: { transform: 'rotate(-8deg) scale(1.12)',    transition: '.25s' },
    tilePress: { transform: 'rotate(0) scale(.92)',         transition: '.08s' },
  },
} as const;
