// Era + Culture Lock System
// Injects hard era/culture constraints into every image generation prompt.
// Without these locks the image model defaults to wrong era/wrong culture imagery.

export interface EraLock {
  positive: string;
  negative: string;
  label: string;
  yearNum: number | null;
}

export interface CultureLock {
  positive: string;
  label: string;
}

export interface FullLock {
  positive: string;   // prepended to image prompt
  negative: string;   // appended to negative prompt
  sceneContext: string; // injected into LLM scene-plan / story-expand system prompt
  label: string;      // shown in UI badge
}

// ─── ERA DATA ────────────────────────────────────────────────────────────────

interface EraEntry {
  label: string;
  positive: string;
  negative: string;
}

const ERA_MAP: Array<{ maxYear: number; entry: EraEntry }> = [
  {
    maxYear: -10000,
    entry: {
      label: "Prehistoric / Stone Age",
      positive: "Paleolithic era. Stone Age. Rough flint and stone tools only. Cave paintings on rock walls. Animal skin clothing — no weaving. No metal of any kind. Open fire from flint. Caves and rock shelters. Hunter-gatherer life. Bones and stones as tools. Dense untouched wilderness.",
      negative: "any metal, swords, pottery, woven fabric, buildings, writing, wheels, agriculture, Roman columns, medieval architecture, Victorian clothing, contemporary fashion, electricity, glass, horses ridden (not yet domesticated)",
    },
  },
  {
    maxYear: -3000,
    entry: {
      label: "Neolithic / Early Civilization",
      positive: "Neolithic era. Early mud-brick and wattle settlements. Simple pottery and early weaving. Stone and early copper tools. Clay ovens and open fires. No written language. Village communal life, early farming, oxen. River valley settlements.",
      negative: "bronze swords, iron, castles, glass windows, printed text, paved roads, modern clothing, electricity, any technology past early copper",
    },
  },
  {
    maxYear: -500,
    entry: {
      label: "Ancient Civilizations (Bronze Age)",
      positive: "Ancient civilization. Bronze age. Sandals, linen or wool draped robes. Open-air stone temples and columns. Clay oil lamps and reed torches. Papyrus scrolls. Chariots and horses. Clay tablets. Outdoor markets with amphorae. No glass windows. No chimneys.",
      negative: "iron plate armor, medieval castles, printing press, gunpowder, chimneys, modern shoes, electricity, any element from after 500 AD",
    },
  },
  {
    maxYear: 500,
    entry: {
      label: "Classical Antiquity (Greek / Roman / Ancient African Kingdoms)",
      positive: "Classical antiquity. Roman togas and tunics, Greek chitons, sandals, laurel wreaths. Stone columns and mosaic floors. Aqueducts, wooden carts, olive oil clay lamps. Gladius swords and shields, legionnaire armor. Baths and forums. For African settings: Kingdom of Kush stone temples, gold and bronze jewelry, ivory, fine woven garments, elaborate headdresses.",
      negative: "plate armor (full suits), medieval castles, printing press, cannon, gunpowder, firearms, stirrups, glass windows (common), chimneys, clocks",
    },
  },
  {
    maxYear: 1000,
    entry: {
      label: "Early Medieval / Viking Age / Dark Ages (500–1000 AD)",
      positive: "Early medieval period. Chainmail and iron weapons. Thatched and timber longhouses. Reed torches and rushlight candles. Parchment manuscripts. Saddle and stirrup horses. Wool tunics, leather boots, cloaks with brooches. Viking longships. Byzantine gold mosaics. For African settings: early Ghana Empire gold trade, mud-brick and timber structures, early kente and woven textiles, beaded jewelry, oral culture griots.",
      negative: "full plate armor suits, printing press, gunpowder, cannons, common glass windows, chimneys on all buildings, pocket clocks, eyeglasses, any post-1000 AD technology, modern clothing, electricity, smartphones",
    },
  },
  {
    maxYear: 1300,
    entry: {
      label: "High Medieval / Crusades (1000–1300 AD)",
      positive: "High medieval period. Chainmail transitioning to plate armor. Gothic stone churches and castle towers. Stained glass in churches only. Tallow candles and torches. Quill and ink manuscripts. Knights on heavy warhorses. Feudal villages with market squares. For African settings: Mali Empire gold caravans, Great Zimbabwe stone walls, trans-Saharan trade, flowing robes and turbans, mosque minarets, Timbuktu scholarly centers.",
      negative: "gunpowder weapons, printing press, full chimneys on common buildings, eyeglasses widespread, pocket watches, modern roads, electricity",
    },
  },
  {
    maxYear: 1500,
    entry: {
      label: "Late Medieval / Early Renaissance (1300–1500 AD)",
      positive: "Late medieval and early Renaissance. Full plate armor on knights. Gothic and early Renaissance architecture. Illuminated manuscripts and early printed books (late 1400s). Cathedral flying buttresses. Market towns with guild signs. Fur-lined noble robes. Cobblestone city streets. For African settings: Songhai Empire, Benin bronze casting, royal courts with elaborate beaded regalia, Timbuktu as center of Islamic learning.",
      negative: "widespread muskets, Baroque architecture, chimneys everywhere, any post-1500 clothing, early modern fashion",
    },
  },
  {
    maxYear: 1650,
    entry: {
      label: "Renaissance / Early Modern (1500–1650)",
      positive: "Renaissance era. Doublets, ruffs and hose for men, corseted gowns for women. Early muskets and pikes. Galleons and tall sailing ships. Cobblestone city streets. Oil paintings. Guild craftsmen workshops. For African settings: Songhai Empire height, Benin Kingdom bronze art, Great Mosque of Djenné, elaborate court dress with gold jewelry, ivory and cloth trade.",
      negative: "powdered wigs (not yet), Baroque dominant, steam devices, modern clothing, electricity, mass printing",
    },
  },
  {
    maxYear: 1750,
    entry: {
      label: "Baroque / Colonial Era (1650–1750)",
      positive: "Baroque period. Powdered wigs, lace cravats, silk waistcoats, long embroidered coats. Flintlock pistols and muskets. Horse-drawn carriages on cobblestone. Candles and oil lanterns. Harpsichords. Formal gardens. Tall ship fleets. For African settings: Kingdom of Dahomey warrior culture, Ashanti gold court, elaborate ceremonial dress, colorful kente cloth.",
      negative: "top hats (Victorian), industrial machinery, steam engines, electric light, photography, railways, contemporary clothing",
    },
  },
  {
    maxYear: 1820,
    entry: {
      label: "Georgian / Enlightenment (1750–1820)",
      positive: "Georgian or Enlightenment era. Tricorn hats, frock coats, knee breeches. Empire-line dresses for women. Candlelit drawing rooms. Horse-drawn coaches. Quill pens and inkwells. Scientific instruments and globes. Coffee houses and newspapers. For African settings: Oyo Empire expansion, Fulani emirate era, elaborate brass and bronze royal artifacts, intricate cloth weaving on horizontal looms.",
      negative: "steam trains running, top hats dominant, photography, telegraphy, industrial factories, modern roads, electric light",
    },
  },
  {
    maxYear: 1870,
    entry: {
      label: "Early Victorian / Industrial Revolution (1820–1870)",
      positive: "Early Victorian and Industrial era. Top hats and frock coats. Corsets, crinolines, and bonnets for women. Steam trains and early factories belching smoke. Gas lighting in cities only. Early daguerreotype photography. Omnibus horse carriages. Iron bridges. For African settings: missionary period, colonial trading posts alongside traditional kingdoms, Victorian-era Lagos and Cape Town, mix of European cloth and traditional dress.",
      negative: "automobiles, electric light common, telephones, bicycles common, any post-1870 fashion or technology",
    },
  },
  {
    maxYear: 1914,
    entry: {
      label: "High Victorian / Edwardian (1870–1914)",
      positive: "High Victorian or Edwardian era. Bustles and tailored suits. Bicycles, early motorcars. Electric street lighting in cities. Telephone exchanges. Steamships. Bowler hats. Parasols and white gloves. Formal dining rooms with gasoliers. For African settings: colonial administrative buildings alongside market compounds, Yoruba indigo-dyed adire cloth, returnee Brazilian-influenced architecture in Lagos, early African newspapers.",
      negative: "aircraft common, radio broadcasts, early cinema widespread, fully modern fashion, skyscrapers, smartphones",
    },
  },
  {
    maxYear: 1945,
    entry: {
      label: "World Wars / Jazz Age / Art Deco (1914–1945)",
      positive: "Interwar and World War era. Art Deco architecture. Cloche hats and flapper dresses (1920s). Military khaki uniforms (1940s). Bakelite radio sets. Early black and white cinema. Rounded-body automobiles. Telegram offices. Gramophone records. For African settings: early independence movement era, West African newspapers, early urban Lagos and Accra, mix of traditional and Western dress, galoshes and lace-up shoes.",
      negative: "smartphones, computers, post-1945 cars, television, color film dominant, modern glass towers",
    },
  },
  {
    maxYear: 1980,
    entry: {
      label: "Post-War / African Independence Era (1945–1980)",
      positive: "Mid 20th century. Post-war modernism. Fin-tailed cars and Volkswagen Beetles. Black-and-white then color television. Vinyl records. For African settings: independence celebrations 1960s — flowing boubou and agbada, military coup imagery, pan-African dashiki pride, Afrobeat music era, Peugeot 504 taxis, colorful political rallies, open-air cinemas, natural afro hairstyles.",
      negative: "smartphones, internet, flat-screen TVs, modern SUVs, post-1980 fashion, social media, streaming",
    },
  },
  {
    maxYear: 2000,
    entry: {
      label: "1980s–90s",
      positive: "1980s to 1990s. Large brick mobile phones or no phones. Boomboxes and Walkman cassette players. VHS tapes. Neon colors (80s) or grunge (90s). Box-shaped older model cars. CRT televisions. For African settings: Nollywood VHS hawking era, market cassette stalls, okada motorcycle taxis, 90s fashion — bright prints, shoulder pads, high-waist jeans, Aba-made plastic shoes.",
      negative: "smartphones, flat-screen TV, social media platforms, post-2000 car designs, streaming services",
    },
  },
  {
    maxYear: 2015,
    entry: {
      label: "Early 21st Century (2000–2015)",
      positive: "Early 2000s to mid 2010s. Early smartphones and flip phones. Flat-screen TVs appearing. SUVs and sedans. Social media emerging. For African settings: Nollywood DVD era, BRT buses appearing in Lagos, bank branch queues, generator exhaust everywhere, DSTV satellite dishes on rooftops, Ankara fashion resurgence, Blackberry phones, MTN yellow kiosks.",
      negative: "TikTok, AI assistants, post-2015 ultra-thin phone designs, modern electric cars, streaming-only culture",
    },
  },
  {
    maxYear: 9999,
    entry: {
      label: "Contemporary Modern (2015–present)",
      positive: "Contemporary modern era. Smartphones everywhere. Streaming culture. Modern glass-and-steel architecture. Electric cars and ride-sharing. Social media visible. For African settings: contemporary Lagos — Lekki high-rises alongside Bole food stalls, Afrobeats concerts, Ankara mixed with streetwear, expressway traffic, ride-share apps on iPhones, Afrocentric Instagram aesthetic, modern shopping malls.",
      negative: "horses as primary transport, medieval clothing, ancient ruins as primary setting, primitive stone tools, candles as only light source, pre-industrial technology",
    },
  },
];

// ─── CULTURE DATA ─────────────────────────────────────────────────────────────

const CULTURE_MAP: Record<string, string> = {
  // Nigerian / West African
  nigerian: "Nigerian West African culture. Yoruba, Igbo, or Hausa-Fulani society. Ankara and Aso-oke fabrics. Gele headwraps. Agbada and iro-buba garments. Tropical vegetation. Lagos or Abuja urban setting where era-appropriate. Warm skin tones. Culturally authentic Nigerian environment.",
  yoruba: "Yoruba West African culture. Coral bead crowns (ade), aso-oke woven cloth, bronze and brass artifacts, talking drum ceremonies, masquerade festival imagery, compounds with carved wooden doors and open courtyards. Tropical setting.",
  igbo: "Igbo West African culture. Chi shrines, elaborate face and body painting, iron-smelting craft, trade beads, obi community halls, tropical forest setting.",
  hausa: "Hausa-Fulani North Nigerian culture. Walled city gates (Kofar), turban and babanriga robes, Islamic geometric architecture, leather craft markets, trans-Saharan trade route atmosphere, Sahelian landscape.",
  nollywood: "Contemporary Nigerian Nollywood culture. Modern Lagos or Abuja setting. Mix of traditional Ankara and Western fashion. Afrobeats cultural energy. Urban tropical aesthetic. Real Nigerian architecture and street life.",
  "west african": "West African culture. Warm tropical environment. Traditional cloth patterns, vibrant colors, open-air markets, palm trees, red laterite earth, tropical vegetation.",
  african: "Sub-Saharan African culture appropriate to the era. Authentic African setting — NOT primitive or stereotyped. Real cultural accuracy for the specific era and region.",
  // European
  english: "English culture. British aesthetic appropriate to era. Tea culture. Class system visible in dress. English architecture and landscape.",
  french: "French culture. Parisian or provincial French aesthetic. Cafés, fashion leadership appropriate to era. French architecture.",
  european: "Western European culture appropriate to the era. Temperate climate. European architecture, clothing, and customs for the specific century.",
  victorian: "Victorian English culture. British Empire era aesthetics. Class hierarchy visible. London fog and gas lamps. English country houses and working-class streets.",
  // Asian
  japanese: "Japanese culture appropriate to the era. Authentic Japanese setting, architecture, and fashion for the specific historical period.",
  chinese: "Chinese culture appropriate to the era. Authentic Chinese setting, architecture, and fashion for the specific dynasty or modern period.",
  // Middle Eastern
  arabic: "Arab Middle Eastern culture appropriate to the era. Islamic architecture, Arabic calligraphy, desert or urban Arab setting.",
  // Latin American
  latin: "Latin American culture appropriate to the era. Spanish colonial or contemporary Latin American setting.",
  // Western / American (added 2026-05-27 — were MISSING, causing culture selections to resolve to "")
  american: "Contemporary American (USA) culture. North American urban or suburban setting, modern Western fashion and architecture, American English. Default to a light-to-medium Western appearance unless the story or characters specify another background.",
  usa: "Contemporary American (USA) culture. North American setting, modern Western fashion, American English. Light-to-medium Western appearance unless otherwise specified.",
  white: "Western Caucasian appearance in a contemporary Western (American or European) setting with modern fashion, unless the story specifies another background.",
  hollywood: "Hollywood / American cinema culture. Contemporary Western USA aesthetic, film-set glamour, modern American fashion and locations.",
  // South & East Asian
  bollywood: "Bollywood Indian culture. Hindi-cinema aesthetic — South Asian (Indian) people, vibrant colors, sarees, kurtas and lehengas, gold jewelry, expressive song-and-dance energy, Indian urban or village setting.",
  indian: "Indian South Asian culture appropriate to the era. Authentic Indian setting, clothing (sarees, kurtas), and customs.",
  asian: "East or South-East Asian culture appropriate to the era — authentic setting, architecture, and fashion; do NOT default to a Western look.",
};

// ─── YEAR PARSING ─────────────────────────────────────────────────────────────

export function parseEraYear(input: string): number | null {
  if (!input?.trim()) return null;
  const s = input.trim().toLowerCase();

  if (s === "today" || s === "now" || s === "present" || s === "contemporary" || s === "modern") {
    return new Date().getFullYear();
  }

  // "300 bc" / "300bc" → -300
  const bcMatch = s.match(/(\d+)\s*bc/i);
  if (bcMatch) return -parseInt(bcMatch[1]);

  // "899 ad" / "899ad" → 899
  const adMatch = s.match(/(\d+)\s*ad/i);
  if (adMatch) return parseInt(adMatch[1]);

  // plain number "1819", "2024"
  const numMatch = s.match(/(\d{3,4})/);
  if (numMatch) {
    const y = parseInt(numMatch[1]);
    return y;
  }

  // keyword era labels
  if (s.includes("prehistoric") || s.includes("stone age") || s.includes("caveman")) return -30000;
  if (s.includes("neolithic") || s.includes("ancient")) return -4000;
  if (s.includes("medieval") && (s.includes("early") || s.includes("dark"))) return 700;
  if (s.includes("medieval") && s.includes("high")) return 1150;
  if (s.includes("medieval")) return 1200;
  if (s.includes("renaissance")) return 1550;
  if (s.includes("baroque") || s.includes("colonial")) return 1700;
  if (s.includes("georgian") || s.includes("enlightenment")) return 1780;
  if (s.includes("victorian") && s.includes("early")) return 1845;
  if (s.includes("victorian") || s.includes("edwardian")) return 1890;
  if (s.includes("1920") || s.includes("jazz")) return 1925;
  if (s.includes("independence") || s.includes("1960")) return 1965;
  if (s.includes("90s") || s.includes("nineties")) return 1993;
  if (s.includes("80s") || s.includes("eighties")) return 1985;

  return null;
}

function getEraEntry(year: number): EraEntry {
  for (const { maxYear, entry } of ERA_MAP) {
    if (year <= maxYear) return entry;
  }
  return ERA_MAP[ERA_MAP.length - 1].entry;
}

// ─── CULTURE RESOLUTION ───────────────────────────────────────────────────────

function resolveCulture(storyCulture: string, artStyle: string): string {
  // CULTURE (ethnicity + setting) must come ONLY from the explicit culture/region.
  // The art style ("nollywood", "realistic", "3d-cinematic" ...) is a RENDER look,
  // NOT an ethnicity. Using artStyle here was the INVERSION bug (fixed 2026-05-27):
  // a "nollywood" art style made every scene African regardless of the selected
  // culture, and an empty culture left no lock → the model defaulted to white.
  void artStyle; // intentionally ignored for ethnicity resolution
  const input = (storyCulture || "").toLowerCase().trim();
  if (!input) return "";

  for (const [key, desc] of Object.entries(CULTURE_MAP)) {
    if (input.includes(key)) return desc;
  }

  return "";
}

// ─── SCENE DESCRIPTION → STATIC FRAME ────────────────────────────────────────
// Strips action/motion language so the image model renders a still frame, not chaos

const ACTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(running|runs|ran|fleeing|flees|fled|chasing|chases|chased)\b/gi, "standing tensely"],
  [/\b(fighting|fights|fought|attacking|attacks|attacked|battling|battles)\b/gi, "facing each other"],
  [/\b(crying|cries|screaming|screams|shouting|shouts)\b/gi, "with intense expression"],
  [/\b(falling|falls|fell|jumping|jumps|leaping|leaps)\b/gi, "in motion pose"],
  [/\b(exploding|explodes|burning|burns|collapsing|collapses)\b/gi, "dramatic scene"],
  [/\b(rushing|rushes|sprinting|sprints|dashing|dashes)\b/gi, "moving urgently"],
  [/\b(sweeping|swept|floods|flooding|crashes|crash)\b/gi, "amid dramatic elements"],
];

export function toStaticFrame(description: string): string {
  if (!description) return description;
  let result = description;
  for (const [pattern, replacement] of ACTION_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return `${result} Cinematic still frame. Single frozen moment.`;
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

export function buildFullLock(storyEra: string, storyCulture: string, artStyle = ""): FullLock {
  const year = parseEraYear(storyEra);
  const eraEntry = year !== null ? getEraEntry(year) : null;
  const cultureDesc = resolveCulture(storyCulture, artStyle);

  const eraPositive = eraEntry
    ? `[ERA LOCK — ${eraEntry.label}]: ${eraEntry.positive}`
    : "";

  const eraNegative = eraEntry
    ? eraEntry.negative
    : "";

  const culturePositive = cultureDesc
    ? `[CULTURE LOCK]: ${cultureDesc}`
    : "";

  const positive = [eraPositive, culturePositive].filter(Boolean).join("\n\n");

  const label = [
    eraEntry?.label || (storyEra || ""),
    storyCulture || artStyle || "",
  ].filter(Boolean).join(" · ");

  // For LLM scene-plan / story-expand context
  const sceneContext = [
    eraEntry
      ? `ERA CONTEXT: This story is set in ${eraEntry.label}. Every scene description MUST reflect the visual reality of that era. ${eraEntry.positive} Do NOT include any element that did not exist in that era (forbidden: ${eraEntry.negative}).`
      : "",
    cultureDesc
      ? `CULTURE CONTEXT: ${cultureDesc}`
      : "",
  ].filter(Boolean).join("\n\n");

  return { positive, negative: eraNegative, sceneContext, label };
}
