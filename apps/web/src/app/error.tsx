"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-5 bg-bg text-text">
      <p className="text-sm text-text-soft mb-4">Something went wrong. Please try again.</p>
      <button
        onClick={reset}
        className="bg-green text-on-green border-0 rounded-lg px-7 py-3 text-sm font-bold cursor-pointer"
      >
        Try again
      </button>
    </div>
  );
}
