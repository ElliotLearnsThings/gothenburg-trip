import type { Metadata } from "next";
import Link from "next/link";
import { stops, huntSchedule } from "../stops";

export const metadata: Metadata = {
  title: "🗝️ Game Master's Cheat Sheet",
  description: "Secret solutions page for the hunt game master.",
  robots: { index: false, follow: false },
};

export default function CheatSheet() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-8">
      <header className="pt-12 pb-8 text-center">
        <p className="mb-3 text-sm tracking-[0.35em] uppercase text-coral-deep">
          🤫 top secret · game master only 🤫
        </p>
        <h1 className="text-4xl text-ink sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          🗝️ The Cheat Sheet
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-soft">
          Every stop, every clue, every answer — always visible, no countdown, no team needed. If a
          duo is hopelessly stuck on hunt day ({huntSchedule.dayLabel}, {huntSchedule.startLabel}–
          {huntSchedule.endLabel}), whisper them a hint from here. Don&apos;t share the URL!
        </p>
      </header>

      <ol className="grid gap-5">
        {stops.map((stop) => (
          <li
            key={stop.id}
            className="relative rounded-3xl border-[3px] border-ink bg-cream p-6 shadow-[5px_6px_0_rgba(59,47,36,0.22)]"
          >
            <div
              className="absolute -top-4 -left-3 flex h-11 w-11 rotate-[-6deg] items-center justify-center rounded-full border-[3px] border-ink bg-coral text-lg font-bold text-cream"
              style={{ fontFamily: "var(--font-display)" }}
              aria-hidden="true"
            >
              {stop.num}
            </div>
            {stop.mustGo && (
              <div className="absolute -top-3 right-4 rotate-[3deg] rounded-full border-2 border-ink bg-coral px-3 py-0.5 text-xs font-bold text-cream">
                ★ MUST GO
              </div>
            )}
            <h2 className="pl-6 text-2xl" style={{ fontFamily: "var(--font-display)" }}>
              {stop.emoji} {stop.name}
            </h2>
            {stop.swedishName && (
              <p className="mt-0.5 pl-6 text-sm text-ink-soft italic">{stop.swedishName}</p>
            )}
            <p className="mt-1 pl-6 text-xs tracking-widest uppercase text-blue">📍 {stop.area}</p>
            <p className="mt-3 text-[15px] leading-relaxed">{stop.description}</p>
            <div className="mt-3 rounded-xl border-2 border-dashed border-gold-deep bg-paper px-4 py-3">
              <p style={{ fontFamily: "var(--font-hand)", fontSize: "1.25rem", lineHeight: 1.3 }}>
                🔎 <strong>The clue &amp; its answer:</strong> {stop.clue}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border-2 border-ink/20 bg-paper px-3 py-1">
                🕐 {stop.hours}
              </span>
              <span className="rounded-full border-2 border-ink/20 bg-paper px-3 py-1">
                🎟️ {stop.price}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-center text-sm text-ink-soft">
        <Link href="/" className="underline">
          ← back to the public hunt page
        </Link>{" "}
        (sealed until kickoff, as it should be)
      </p>
    </main>
  );
}
