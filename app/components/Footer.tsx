// Footer — 7 legal page links, v14 styling
import { ds } from "../../lib/designSystem";

const LEGAL_LINKS = [
  { label: "Terms of Use",          href: "/terms" },
  { label: "Privacy Policy",        href: "/privacy" },
  { label: "Acceptable Use",        href: "/acceptable-use" },
  { label: "AI Disclosure",         href: "/ai-disclosure" },
  { label: "DMCA / Takedown",       href: "/dmca" },
  { label: "Cookies",               href: "/cookies" },
  { label: "Sound Licensing",       href: "/sound-licensing" },
];

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: `1px solid ${ds.color.line}`,
        padding: "20px 32px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px 16px",
        fontFamily: ds.font.mono,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: ds.color.mute2,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        GioHomeStudio
      </span>
      {LEGAL_LINKS.map(link => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 11,
            color: ds.color.mute2,
            textDecoration: "none",
            fontFamily: ds.font.mono,
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = ds.color.lilac)}
          onMouseLeave={e => (e.currentTarget.style.color = ds.color.mute2)}
        >
          {link.label}
        </a>
      ))}
    </footer>
  );
}
