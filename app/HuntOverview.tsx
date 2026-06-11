"use client";

import { useEffect, useMemo, useState } from "react";
import TeamAlbum from "./TeamAlbum";
import { stops, type HuntPhotos, type Team } from "./stops";

const CONFETTI_COLORS = [
  "var(--coral)",
  "var(--gold)",
  "var(--park-deep)",
  "var(--sea-deep)",
  "var(--blue)",
];

function Confetti() {
  // generated client-side on mount so SSR/hydration stay deterministic
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 3.5 + Math.random() * 3,
        size: 7 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: i % 3 === 0,
      })),
    []
  );
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 9000);
    return () => clearTimeout(id);
  }, []);
  if (done) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.6),
            background: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export type Standing = {
  team: Team;
  points: number;
};

export default function HuntOverview({
  photos,
  standings,
}: {
  photos: HuntPhotos;
  standings: Standing[];
}) {
  const champion = standings[0];
  const isTie = standings.length > 1 && standings[1].points === champion?.points;

  return (
    <section aria-label="Hunt overview" className="pop-in mb-12">
      <Confetti />
      <div className="rounded-3xl border-4 border-gold-deep bg-cream p-6 text-center shadow-[6px_8px_0_rgba(59,47,36,0.25)] sm:p-9">
        <p className="text-xs tracking-[0.3em] uppercase text-coral-deep">
          🎆 the hunt is over 🎆
        </p>
        <h2 className="mt-2 text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          What a day, hunters!
        </h2>
        {champion && champion.points > 0 && (
          <p className="mt-4 text-2xl" style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}>
            👑 Champions: {champion.team.emoji} {champion.team.name} — first to{" "}
            {champion.points} of {stops.length} places{isTie ? " (by the earliest claim!)" : "!"}
          </p>
        )}

        <div className="mx-auto mt-6 grid max-w-md gap-3">
          {standings.map(({ team, points }, i) => (
            <div
              key={team.id}
              className={`flex items-center gap-3 rounded-2xl border-[3px] border-ink p-3 text-left ${
                i === 0 ? "bg-gold/30" : "bg-paper"
              }`}
            >
              <span className="text-2xl">{["🥇", "🥈", "🥉", "🏅"][i] ?? "🏅"}</span>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink text-xl"
                style={{ background: team.color }}
              >
                {team.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{team.name}</p>
                <p className="text-xs text-ink-soft">
                  {points} {points === 1 ? "place" : "places"} claimed first
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-ink-soft">
          Scroll on for every proof photo from all crews — the real treasure was the kanelbullar
          we ate along the way. 🧡
        </p>
      </div>

      {standings.map(({ team }) => (
        <TeamAlbum key={team.id} team={team} album={photos[team.id]} />
      ))}
    </section>
  );
}
