import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <h1 className="text-4xl font-bold text-white">GioHomeStudio</h1>
      <p className="text-gray-400 text-lg max-w-xl">
        AI-powered video content studio. Generate, review, approve, and track your content from one place.
      </p>
      <div className="flex gap-4 mt-4">
        <Link
          href="/dashboard"
          className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Open Studio
        </Link>
        <Link
          href="/dashboard/review"
          className="border border-gray-700 hover:border-gray-500 text-gray-300 px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Review Queue
        </Link>
      </div>
    </div>
  );
}
