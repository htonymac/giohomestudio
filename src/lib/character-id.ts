// Character ID generator — format: COUNTRY_NAMEageATTRIBUTE
// e.g. US_JAMES57BLACK1, NG_TUNDE38FAIRBLACK, JP_KAKACHI21WHITENINJA

const COUNTRY_CODES: Record<string, string> = {
  nigeria: "NG", "united states": "US", usa: "US", uk: "UK", "united kingdom": "UK",
  ghana: "GH", "south africa": "ZA", kenya: "KE", japan: "JP", china: "CN",
  india: "IN", brazil: "BR", france: "FR", germany: "DE", spain: "ES",
  mexico: "MX", canada: "CA", australia: "AU", italy: "IT", korea: "KR",
  egypt: "EG", morocco: "MA", ethiopia: "ET", cameroon: "CM", senegal: "SN",
};

export function generateCharacterId(opts: {
  country?: string;
  name: string;
  age?: string;
  skinTone?: string;
  attribute?: string;
}): string {
  const countryCode = opts.country
    ? COUNTRY_CODES[opts.country.toLowerCase()] || opts.country.slice(0, 2).toUpperCase()
    : "XX";

  // Keep alpha chars + trailing digits so "CHARACTER_1" and "CHARACTER_2" produce different IDs
  const nameAlpha = opts.name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 8);
  const nameDigits = (opts.name.match(/\d+$/) || [""])[0].slice(0, 4);
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  const cleanName = `${nameAlpha}${nameDigits}${rand}`;

  // Parse age from age group or number
  let ageNum = "";
  if (opts.age) {
    const n = parseInt(opts.age);
    if (!isNaN(n)) {
      ageNum = String(n);
    } else {
      const ageMap: Record<string, string> = {
        child: "8", teen: "15", young_adult: "25", adult: "35", elder: "65",
      };
      ageNum = ageMap[opts.age] || "30";
    }
  }

  const skin = (opts.skinTone || "").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 8);
  const attr = (opts.attribute || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);

  const parts = [countryCode, "_", cleanName, ageNum, skin, attr].filter(Boolean);
  return parts.join("");
}

export function parseCharacterId(charId: string): {
  country: string;
  name: string;
  age: string;
  attributes: string;
} {
  const match = charId.match(/^([A-Z]{2})_([A-Z]+?)(\d+)(.*)$/);
  if (!match) return { country: "??", name: charId, age: "", attributes: "" };
  return {
    country: match[1],
    name: match[2],
    age: match[3],
    attributes: match[4],
  };
}
