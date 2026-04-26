// Auth pages layout — no sidebar, centered card
import "../globals.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#070710", color: "#eeeeff", fontFamily: "'Outfit', system-ui, sans-serif", fontSize: 13 }}
      >
        {children}
      </body>
    </html>
  );
}
