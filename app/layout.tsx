import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GioHomeStudio",
  description: "AI-powered video content studio and publishing control system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <header className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-lg font-bold text-white tracking-tight">
              GioHomeStudio
            </span>
            <nav className="flex gap-6 text-sm text-gray-400">
              <a href="/dashboard" className="hover:text-white transition-colors">Studio</a>
              <a href="/dashboard/review" className="hover:text-white transition-colors">Review</a>
              <a href="/dashboard/registry" className="hover:text-white transition-colors">Registry</a>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
