"use client";

import { stops, type StoredPhoto, type Team } from "./stops";

export default function TeamAlbum({
  team,
  album,
}: {
  team: Team;
  album: Record<string, StoredPhoto> | undefined;
}) {
  const entries = stops
    .filter((s) => album?.[s.id])
    .map((s) => ({ stop: s, photo: (album as Record<string, StoredPhoto>)[s.id] }));

  // the widget only appears once the team has photos
  if (entries.length === 0) return null;

  return (
    <section
      aria-label={`${team.name} photo album`}
      className="mt-10 rounded-3xl border-[3px] border-ink bg-cream p-6 shadow-[5px_6px_0_rgba(59,47,36,0.22)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
          📸 {team.emoji} {team.name}&apos;s treasure album
        </h3>
        <span className="text-sm text-ink-soft">
          {entries.length}/{stops.length} proofs collected
        </span>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {entries.map(({ stop, photo }, i) => (
          <li
            key={stop.id}
            className={`overflow-hidden rounded-2xl border-[3px] border-ink bg-paper shadow-[3px_4px_0_rgba(59,47,36,0.2)] ${
              i % 2 ? "rotate-[0.8deg]" : "rotate-[-0.8deg]"
            }`}
          >
            {/* polaroid */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`${team.name} proof photo at ${stop.name}`}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            <p
              className="truncate px-2 py-1.5 text-center text-sm"
              style={{ fontFamily: "var(--font-hand)", fontWeight: 600 }}
            >
              {stop.emoji} {stop.num}. {stop.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
