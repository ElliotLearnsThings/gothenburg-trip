"use client";

import type { Stop } from "./stops";

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const mx = (prev.x + cur.x) / 2;
    const my = (prev.y + cur.y) / 2;
    // gentle perpendicular bow so the route meanders like a footpath
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(26, len * 0.18) * (i % 2 === 0 ? 1 : -1);
    const cx = mx + (-dy / len) * bow;
    const cy = my + (dx / len) * bow;
    d += ` Q ${cx} ${cy} ${cur.x} ${cur.y}`;
  }
  return d;
}

function Marker({
  stop,
  found,
  isLast,
  onSelect,
}: {
  stop: Stop;
  found: boolean;
  isLast: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <g
      role="button"
      aria-label={`Stop ${stop.num}: ${stop.name}${found ? " (found)" : ""}`}
      tabIndex={0}
      className="cursor-pointer outline-none focus-visible:opacity-80"
      onClick={() => onSelect(stop.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(stop.id);
        }
      }}
    >
      {/* generous invisible tap target for mobile */}
      <circle cx={stop.mapX} cy={stop.mapY - 4} r={34} fill="transparent" />
      <ellipse cx={stop.mapX} cy={stop.mapY + 26} rx={16} ry={5} fill="rgba(59,47,36,0.18)" />
      <g className="animate-bob" style={{ animationDelay: `${stop.num * 0.35}s` }}>
        {isLast && (
          <text
            x={stop.mapX}
            y={stop.mapY - 44}
            textAnchor="middle"
            fontSize={26}
            className="sparkle"
            style={{ animationDelay: "0.6s" }}
          >
            ✨
          </text>
        )}
        {/* pin */}
        <path
          d={`M ${stop.mapX} ${stop.mapY + 24} C ${stop.mapX - 22} ${stop.mapY - 2} ${
            stop.mapX - 24
          } ${stop.mapY - 14} ${stop.mapX} ${stop.mapY - 26} C ${stop.mapX + 24} ${
            stop.mapY - 14
          } ${stop.mapX + 22} ${stop.mapY - 2} ${stop.mapX} ${stop.mapY + 24} Z`}
          fill={found ? "var(--gold)" : "var(--coral)"}
          stroke="var(--ink)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <circle
          cx={stop.mapX}
          cy={stop.mapY - 8}
          r={15}
          fill="var(--cream)"
          stroke="var(--ink)"
          strokeWidth={2.5}
        />
        <text x={stop.mapX} y={stop.mapY - 2} textAnchor="middle" fontSize={16}>
          {found ? "⭐" : stop.emoji}
        </text>
        {/* number badge */}
        <circle
          cx={stop.mapX + 17}
          cy={stop.mapY - 24}
          r={11}
          fill="var(--ink)"
          stroke="var(--cream)"
          strokeWidth={2}
        />
        <text
          x={stop.mapX + 17}
          y={stop.mapY - 19.5}
          textAnchor="middle"
          fontSize={12.5}
          fontWeight="bold"
          fill="var(--cream)"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {stop.num}
        </text>
      </g>
      {/* label (hidden on small screens — pins + numbered cards carry the info) */}
      <text
        className="hidden sm:block"
        x={stop.mapX}
        y={stop.mapY + 44}
        textAnchor="middle"
        fontSize={17}
        fill="var(--ink)"
        stroke="var(--paper)"
        strokeWidth={4}
        paintOrder="stroke"
        style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}
      >
        {stop.name}
      </text>
    </g>
  );
}

export default function TreasureMap({
  stops,
  found,
  onSelect,
}: {
  stops: Stop[];
  found: Set<string>;
  onSelect: (id: string) => void;
}) {
  const route = smoothPath(stops.map((s) => ({ x: s.mapX, y: s.mapY })));

  return (
    <svg
      viewBox="0 0 1000 720"
      className="w-full h-auto"
      role="img"
      aria-label="Illustrated treasure map of Gothenburg with numbered stops"
    >
      <defs>
        <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" result="n" seed="7" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="6" />
        </filter>
      </defs>

      {/* parchment base */}
      <rect x="14" y="14" width="972" height="692" rx="26" fill="var(--cream)" stroke="var(--ink)" strokeWidth="4" />
      <rect x="26" y="26" width="948" height="668" rx="18" fill="none" stroke="var(--gold-deep)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" opacity="0.7" />

      <g filter="url(#wobble)">
        {/* Hisingen — north bank */}
        <path d="M 14 14 L 986 14 L 986 96 C 840 120 700 86 560 110 C 420 134 300 104 170 140 C 110 156 60 150 14 138 Z" fill="var(--paper-deep)" />
        {/* Göta älv river */}
        <path
          d="M 14 138 C 60 150 110 156 170 140 C 300 104 420 134 560 110 C 700 86 840 120 986 96 L 986 176 C 850 200 710 168 580 190 C 440 214 330 186 200 220 C 130 238 64 230 14 216 Z"
          fill="var(--sea)"
        />
        {/* canal / moat around the old town */}
        <path
          d="M 340 232 C 320 290 330 340 390 372 C 450 404 540 400 600 370 C 660 340 672 286 650 240"
          fill="none"
          stroke="var(--sea)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Slottsskogen park */}
        <ellipse cx="190" cy="588" rx="150" ry="96" fill="var(--park)" />
        {/* Trädgårdsföreningen garden */}
        <ellipse cx="618" cy="296" rx="74" ry="46" fill="var(--park)" />
        {/* Haga hill (Skansen Kronan) */}
        <path d="M 312 502 C 332 458 392 458 412 502 Z" fill="var(--park-deep)" />
      </g>

      {/* river squiggles */}
      <g stroke="var(--sea-deep)" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M 120 178 q 12 -8 24 0 q 12 8 24 0" />
        <path d="M 420 160 q 12 -8 24 0 q 12 8 24 0" />
        <path d="M 760 138 q 12 -8 24 0 q 12 8 24 0" />
      </g>
      <text x="500" y="152" textAnchor="middle" fontSize="22" fill="var(--sea-deep)" letterSpacing="8" style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}>
        ~ GÖTA ÄLV ~
      </text>

      {/* sea serpent */}
      <g className="animate-bob" style={{ animationDelay: "1.1s" }}>
        <path d="M 808 158 q 10 -16 24 -8 q -2 -18 16 -16 q 14 2 12 18" fill="none" stroke="var(--park-deep)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="860" cy="148" r="7" fill="var(--park-deep)" />
        <circle cx="862" cy="146" r="1.8" fill="var(--cream)" />
      </g>
      {/* little boat */}
      <g className="animate-bob" style={{ animationDelay: "0.4s" }}>
        <path d="M 232 184 l 36 0 l -7 12 l -22 0 Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2" />
        <path d="M 250 184 l 0 -20 l 14 14 l -14 0" fill="var(--cream)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      </g>
      {/* harbour crane (Eriksberg) */}
      <g stroke="var(--coral-deep)" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M 218 92 l 0 -44 M 200 92 l 0 -44 M 190 56 l 56 -10 M 246 46 l 0 18" />
      </g>
      {/* Älvsborg Bridge crossing the river to Röda Sten */}
      <g strokeLinecap="round">
        <path d="M 100 106 L 100 246" stroke="var(--ink)" strokeWidth="7" />
        <path d="M 78 132 L 122 132 M 78 214 L 122 214" stroke="var(--ink)" strokeWidth="5" />
        <path d="M 84 132 C 92 168 92 178 84 214 M 116 132 C 108 168 108 178 116 214" fill="none" stroke="var(--coral-deep)" strokeWidth="3" />
      </g>
      {/* Örgryte cottages — home sweet home */}
      <g stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round">
        <g transform="translate(788 420)">
          <rect x="0" y="10" width="26" height="18" fill="var(--gold)" />
          <path d="M -3 10 L 13 -4 L 29 10 Z" fill="var(--coral)" />
        </g>
        <g transform="translate(902 440)">
          <rect x="0" y="10" width="26" height="18" fill="var(--coral)" />
          <path d="M -3 10 L 13 -4 L 29 10 Z" fill="var(--gold)" />
        </g>
        <text x="858" y="408" textAnchor="middle" fontSize="19" fill="var(--ink-soft)" stroke="none" style={{ fontFamily: "var(--font-hand)", fontWeight: 600 }}>
          hem ljuva hem 🧡
        </text>
      </g>
      {/* Liseberg ferris wheel */}
      <g transform="translate(908 612)">
        <circle r="24" fill="none" stroke="var(--ink)" strokeWidth="3.5" />
        <path d="M 0 -24 L 0 24 M -24 0 L 24 0 M -17 -17 L 17 17 M 17 -17 L -17 17" stroke="var(--ink)" strokeWidth="2" />
        <path d="M -14 46 L 0 2 L 14 46" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
        <circle cx="0" cy="-24" r="4.5" fill="var(--coral)" stroke="var(--ink)" strokeWidth="1.5" />
        <circle cx="24" cy="0" r="4.5" fill="var(--gold)" stroke="var(--ink)" strokeWidth="1.5" />
        <circle cx="0" cy="24" r="4.5" fill="var(--park)" stroke="var(--ink)" strokeWidth="1.5" />
        <circle cx="-24" cy="0" r="4.5" fill="var(--sea)" stroke="var(--ink)" strokeWidth="1.5" />
      </g>
      {/* Läppstiftet (the Lipstick) */}
      <g>
        <rect x="486" y="58" width="20" height="36" fill="var(--cream)" stroke="var(--ink)" strokeWidth="2.5" />
        <path d="M 486 58 l 20 0 l -20 -16 Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      {/* seagulls */}
      <g stroke="var(--ink-soft)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M 640 60 q 7 -8 14 0 q 7 -8 14 0" />
        <path d="M 700 84 q 6 -7 12 0 q 6 -7 12 0" />
        <path d="M 180 70 q 6 -7 12 0 q 6 -7 12 0" />
      </g>

      {/* district labels */}
      <g fill="var(--ink-soft)" style={{ fontFamily: "var(--font-hand)", fontWeight: 600 }}>
        <text x="620" y="52" fontSize="19" textAnchor="middle">Hisingen</text>
        <text x="120" y="668" fontSize="21" textAnchor="middle">Slottsskogen 🌳</text>
        <text x="500" y="356" fontSize="19" textAnchor="middle">Inom Vallgraven</text>
        <text x="700" y="608" fontSize="19" textAnchor="middle">Korsvägen</text>
        <text x="585" y="540" fontSize="19" textAnchor="middle">Avenyn</text>
      </g>

      {/* compass rose */}
      <g transform="translate(912 74)">
        <g className="animate-wiggle">
          <circle r="36" fill="var(--cream)" stroke="var(--ink)" strokeWidth="3" />
          <path d="M 0 -28 L 7 0 L 0 28 L -7 0 Z" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M -28 0 L 0 -7 L 28 0 L 0 7 Z" fill="var(--gold)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
          <text y="-44" textAnchor="middle" fontSize="18" fill="var(--ink)" style={{ fontFamily: "var(--font-display)" }}>N</text>
        </g>
      </g>

      {/* the treasure route */}
      <path d={route} fill="none" stroke="var(--cream)" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
      <path
        d={route}
        fill="none"
        stroke="var(--coral-deep)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 14"
        className="route-march"
      />

      {/* X marks the spot under the final stop */}
      {stops.length > 0 && (
        <g
          transform={`translate(${stops[stops.length - 1].mapX} ${stops[stops.length - 1].mapY})`}
          stroke="var(--coral-deep)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.55"
        >
          <path d="M -16 -16 L 16 16 M 16 -16 L -16 16" />
        </g>
      )}

      {stops.map((s, i) => (
        <Marker key={s.id} stop={s} found={found.has(s.id)} isLast={i === stops.length - 1} onSelect={onSelect} />
      ))}
    </svg>
  );
}
