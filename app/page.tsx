"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TreasureMap from "./TreasureMap";
import { stops, teams, routeIntro, bonusStop, huntSchedule, type Team } from "./stops";

const STORAGE_KEY = "gbg-treasure-hunt-v2";

type TeamProgress = {
  found: string[];
  startedAt: number | null;
  finishedAt: number | null;
};

type HuntState = Record<string, TeamProgress>;

const emptyState = (): HuntState =>
  Object.fromEntries(teams.map((t) => [t.id, { found: [], startedAt: null, finishedAt: null }]));

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

const huntStart = () =>
  new Date(
    huntSchedule.start.year,
    huntSchedule.start.month,
    huntSchedule.start.day,
    huntSchedule.start.hour
  );
const huntEnd = () =>
  new Date(huntSchedule.end.year, huntSchedule.end.month, huntSchedule.end.day, huntSchedule.end.hour);

type HuntPhase = "before" | "during" | "after";

function useHuntCountdown(): { phase: HuntPhase; label: string } | null {
  const [state, setState] = useState<{ phase: HuntPhase; label: string } | null>(null);
  useEffect(() => {
    const fmt = (diff: number) => {
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };
    const tick = () => {
      const now = Date.now();
      const start = huntStart().getTime();
      const end = huntEnd().getTime();
      if (now < start) setState({ phase: "before", label: fmt(start - now) });
      else if (now < end) setState({ phase: "during", label: fmt(end - now) });
      else setState({ phase: "after", label: "00:00:00" });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return state;
}

export default function Home() {
  const [hunt, setHunt] = useState<HuntState>(emptyState);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(true);
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const countdown = useHuntCountdown();

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { hunt: HuntState; activeTeamId: string | null };
        setHunt({ ...emptyState(), ...saved.hunt });
        if (saved.activeTeamId && teams.some((t) => t.id === saved.activeTeamId)) {
          setActiveTeamId(saved.activeTeamId);
          setSelectorOpen(false);
        }
      }
    } catch {
      // fresh start
    }
  }, []);

  const persist = useCallback((nextHunt: HuntState, nextActive: string | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hunt: nextHunt, activeTeamId: nextActive }));
    } catch {
      // storage blocked — progress just won't persist
    }
  }, []);

  const chooseTeam = (id: string) => {
    setHunt((prev) => {
      const next = { ...prev };
      if (!next[id].startedAt) next[id] = { ...next[id], startedAt: Date.now() };
      persist(next, id);
      return next;
    });
    setActiveTeamId(id);
    setSelectorOpen(false);
  };

  const toggleFound = (stopId: string) => {
    if (!activeTeamId) {
      setSelectorOpen(true);
      return;
    }
    setHunt((prev) => {
      const team = prev[activeTeamId];
      const foundSet = new Set(team.found);
      if (foundSet.has(stopId)) foundSet.delete(stopId);
      else foundSet.add(stopId);
      const done = foundSet.size === stops.length;
      const next: HuntState = {
        ...prev,
        [activeTeamId]: {
          ...team,
          found: [...foundSet],
          finishedAt: done ? team.finishedAt ?? Date.now() : null,
        },
      };
      persist(next, activeTeamId);
      return next;
    });
    setWinnerDismissed(false);
  };

  const scrollToStop = (id: string) => {
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const activeTeam: Team | null = teams.find((t) => t.id === activeTeamId) ?? null;
  const activeFound = useMemo(
    () => new Set(activeTeamId ? hunt[activeTeamId]?.found ?? [] : []),
    [hunt, activeTeamId]
  );

  const winner = useMemo(() => {
    const finished = teams
      .map((t) => ({ team: t, p: hunt[t.id] }))
      .filter((x) => x.p?.finishedAt != null)
      .sort((a, b) => (a.p.finishedAt as number) - (b.p.finishedAt as number));
    return finished[0] ?? null;
  }, [hunt]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-8">
      {/* ── Team selector overlay ──────────────────────── */}
      {selectorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Choose your team"
        >
          <div className="pop-in my-8 w-full max-w-lg rounded-3xl border-4 border-ink bg-paper p-6 shadow-[8px_10px_0_rgba(59,47,36,0.4)] sm:p-8">
            <p className="text-center text-xs tracking-[0.3em] uppercase text-ink-soft">
              ⚔️ The hunt is on ⚔️
            </p>
            <h2
              className="mt-2 text-center text-3xl sm:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Pick your duo!
            </h2>
            <p className="mt-2 text-center text-sm text-ink-soft">
              Hunt in teams of two. Choose your crew — every duo races the same 12 treasures.
              Fastest team wins!
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {teams.map((t) => {
                const p = hunt[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => chooseTeam(t.id)}
                    className="cursor-pointer rounded-2xl border-[3px] border-ink bg-cream p-4 text-left shadow-[3px_4px_0_rgba(59,47,36,0.25)] transition-transform duration-150 hover:-translate-y-1 active:translate-y-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-ink text-2xl"
                        style={{ background: t.color }}
                      >
                        {t.emoji}
                      </span>
                      <div>
                        <p className="font-bold leading-tight">{t.name}</p>
                        <p className="text-xs text-ink-soft">2 hunters · {t.tagline}</p>
                      </div>
                    </div>
                    {p?.startedAt != null && (
                      <p className="mt-2 text-xs text-blue">
                        ▶ already hunting — {p.found.length}/{stops.length} found
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            {activeTeamId && (
              <button
                type="button"
                onClick={() => setSelectorOpen(false)}
                className="mt-5 w-full cursor-pointer rounded-full border-2 border-ink/30 px-4 py-2 text-sm text-ink-soft hover:bg-cream"
              >
                Never mind, keep playing as {activeTeam?.name}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Winner announcement ────────────────────────── */}
      {winner && !winnerDismissed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Winner announcement"
        >
          <div className="pop-in w-full max-w-md rounded-3xl border-4 border-gold-deep bg-paper p-8 text-center shadow-[8px_10px_0_rgba(59,47,36,0.4)]">
            <p className="text-5xl">
              <span className="sparkle inline-block">✨</span> 👑{" "}
              <span className="sparkle inline-block" style={{ animationDelay: "0.8s" }}>
                ✨
              </span>
            </p>
            <h2 className="mt-3 text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              {winner.team.emoji} {winner.team.name} wins!
            </h2>
            <p className="mt-3 text-ink-soft">
              All {stops.length} treasures found — first across the finish line at Liseberg!
            </p>
            {winner.p.startedAt != null && winner.p.finishedAt != null && (
              <p
                className="mt-4 rounded-2xl border-2 border-dashed border-gold-deep bg-cream px-4 py-3 text-2xl"
                style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}
              >
                ⏱️ Total time: {formatDuration(winner.p.finishedAt - winner.p.startedAt)}
              </p>
            )}
            <p className="mt-3 text-sm text-ink-soft">
              Victory lap on the ferris wheel is mandatory. 🎡
            </p>
            <button
              type="button"
              onClick={() => setWinnerDismissed(true)}
              className="mt-5 w-full cursor-pointer rounded-full border-[3px] border-ink bg-gold px-4 py-2.5 font-bold shadow-[3px_4px_0_rgba(59,47,36,0.3)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            >
              🎉 Hurra!
            </button>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <header className="pop-in pt-10 pb-6 text-center sm:pt-14">
        <p className="mb-3 text-sm tracking-[0.35em] uppercase text-ink-soft">
          ⚓ Göteborg, Sverige ⚓
        </p>
        <h1
          className="text-5xl leading-tight text-ink sm:text-7xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Gothenburg
          <br />
          <span className="relative inline-block text-coral-deep">
            Treasure Hunt
            <svg viewBox="0 0 300 14" className="absolute -bottom-2 left-0 w-full" aria-hidden="true">
              <path
                d="M 4 9 Q 75 2 150 8 T 296 7"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="6"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-lg text-ink-soft">
          {`${stops.length} treasures`} from your doorstep in Örgryte to the lights of Liseberg.
          Two hunters per team — follow the story, tick off the finds, beat the clock!
        </p>
      </header>

      {/* ── Countdown + teams scoreboard ───────────────── */}
      <section
        aria-label="Countdown and team progress"
        className="pop-in mx-auto mb-8 max-w-2xl"
        style={{ animationDelay: "0.15s" }}
      >
        <div className="rounded-3xl border-[3px] border-ink bg-cream px-5 py-4 shadow-[5px_6px_0_rgba(59,47,36,0.25)] sm:px-7 sm:py-5">
          <div className="flex flex-col items-center gap-1 border-b-2 border-dashed border-ink/20 pb-4 text-center">
            <p className="text-xs tracking-[0.3em] uppercase text-ink-soft">
              {countdown?.phase === "during"
                ? "🏁 Reach Liseberg by 18:00 — time left:"
                : countdown?.phase === "after"
                  ? "🌙 The hunt is over — see you at Liseberg!"
                  : `⏳ The hunt begins ${huntSchedule.dayLabel} at 08:00`}
            </p>
            <p
              className={`text-4xl tabular-nums sm:text-5xl ${
                countdown?.phase === "during" ? "text-coral-deep" : "text-ink"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
              suppressHydrationWarning
            >
              {countdown?.label ?? "--:--:--"}
            </p>
            <p className="text-xs text-ink-soft">
              {countdown?.phase === "during"
                ? "hours : minutes : seconds until the 18:00 deadline"
                : countdown?.phase === "after"
                  ? "hope everyone found their treasures!"
                  : "hours : minutes : seconds until kickoff at Örgryte Old Church"}
            </p>
          </div>

          <ul className="mt-4 grid gap-2.5">
            {teams.map((t) => {
              const p = hunt[t.id];
              const n = p?.found.length ?? 0;
              const isActive = t.id === activeTeamId;
              const finished = p?.finishedAt != null;
              const isWinner = winner?.team.id === t.id;
              return (
                <li key={t.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => chooseTeam(t.id)}
                    aria-pressed={isActive}
                    title={`Play as ${t.name}`}
                    className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-[3px] text-lg transition-transform hover:scale-110 ${
                      isActive ? "border-ink ring-2 ring-gold-deep" : "border-ink/40"
                    }`}
                    style={{ background: t.color }}
                  >
                    {t.emoji}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${isActive ? "font-bold" : ""}`}>
                        {t.name}
                        {isActive && <span className="text-blue"> ← you</span>}
                        {isWinner && " 👑"}
                      </span>
                      <span className="shrink-0 text-xs text-ink-soft">
                        {finished && p.startedAt != null && p.finishedAt != null
                          ? `🏁 ${formatDuration(p.finishedAt - p.startedAt)}`
                          : `${n}/${stops.length}`}
                      </span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink/60 bg-paper-deep">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${(n / stops.length) * 100}%`,
                          background: t.color,
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,0.35) 6px 12px)",
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="mt-4 w-full cursor-pointer rounded-full border-2 border-ink/30 px-4 py-1.5 text-xs text-ink-soft hover:bg-paper"
          >
            🔄 Switch team
          </button>
        </div>
      </section>

      {/* ── Map ────────────────────────────────────────── */}
      <section aria-label="Treasure map" className="pop-in" style={{ animationDelay: "0.3s" }}>
        <div className="rotate-[-0.4deg] drop-shadow-[8px_10px_0_rgba(59,47,36,0.18)]">
          <TreasureMap stops={stops} found={activeFound} onSelect={scrollToStop} />
        </div>
        <p className="mt-4 text-center text-sm text-ink-soft">
          (Not to scale — drawn by a very enthusiastic cartographer. Tap a pin to read its clue!)
        </p>
      </section>

      {/* ── Stops ──────────────────────────────────────── */}
      <section aria-label="The stops" className="mt-14">
        <h2
          className="mb-2 text-center text-4xl text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Story in {`${stops.length} Chapters`}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-center text-ink-soft">{routeIntro}</p>

        <ol className="grid gap-6 sm:grid-cols-2">
          {stops.map((stop, i) => {
            const isFound = activeFound.has(stop.id);
            return (
              <li
                key={stop.id}
                id={`stop-${stop.id}`}
                className={`pop-in relative scroll-mt-24 rounded-3xl border-[3px] border-ink p-6 transition-colors duration-300 ${
                  isFound ? "bg-gold/25" : "bg-cream"
                } shadow-[5px_6px_0_rgba(59,47,36,0.22)] ${i % 2 ? "sm:translate-y-6" : ""} ${
                  i % 3 === 0 ? "rotate-[0.5deg]" : "rotate-[-0.5deg]"
                }`}
                style={{ animationDelay: `${0.08 * i}s` }}
              >
                <div
                  className={`absolute -top-4 -left-3 flex h-11 w-11 rotate-[-6deg] items-center justify-center rounded-full border-[3px] border-ink text-lg font-bold text-cream ${
                    isFound ? "bg-park-deep" : "bg-coral"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                  aria-hidden="true"
                >
                  {isFound ? "✓" : stop.num}
                </div>

                {stop.mustGo && (
                  <div className="absolute -top-3 right-4 rotate-[3deg] rounded-full border-2 border-ink bg-coral px-3 py-0.5 text-xs font-bold text-cream">
                    ★ MUST GO
                  </div>
                )}

                <p
                  className="pl-6 text-blue"
                  style={{ fontFamily: "var(--font-hand)", fontSize: "1.2rem", fontWeight: 600 }}
                >
                  {stop.story}
                </p>

                <h3
                  className="mt-1 pl-6 text-2xl leading-snug"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {stop.emoji} {stop.name}
                </h3>
                {stop.swedishName && (
                  <p className="mt-0.5 pl-6 text-sm text-ink-soft italic">{stop.swedishName}</p>
                )}

                <p className="mt-1 pl-6 text-xs tracking-widest uppercase text-blue">
                  📍 {stop.area}
                </p>

                <p className="mt-3 text-[15px] leading-relaxed text-ink">{stop.description}</p>

                <div className="mt-4 rotate-[-0.8deg] rounded-xl border-2 border-dashed border-gold-deep bg-paper px-4 py-3">
                  <p
                    className="text-ink"
                    style={{ fontFamily: "var(--font-hand)", fontSize: "1.3rem", lineHeight: 1.3 }}
                  >
                    🔎 <strong>Your clue:</strong> {stop.clue}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border-2 border-ink/20 bg-paper px-3 py-1">
                    🕐 {stop.hours}
                  </span>
                  <span className="rounded-full border-2 border-ink/20 bg-paper px-3 py-1">
                    🎟️ {stop.price}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFound(stop.id)}
                  aria-pressed={isFound}
                  className={`mt-5 w-full cursor-pointer rounded-full border-[3px] border-ink px-4 py-2.5 text-base font-bold transition-all duration-200 active:translate-y-0.5 active:shadow-none ${
                    isFound
                      ? "bg-park-deep text-cream shadow-[3px_4px_0_rgba(59,47,36,0.3)]"
                      : "bg-gold text-ink shadow-[3px_4px_0_rgba(59,47,36,0.3)] hover:-translate-y-0.5"
                  }`}
                >
                  {isFound
                    ? "⭐ Treasure found!"
                    : activeTeam
                      ? `Mark as found for ${activeTeam.emoji} ${activeTeam.name}`
                      : "Pick a team to start"}
                </button>
              </li>
            );
          })}
        </ol>

        {/* bonus stop */}
        <aside className="mt-12 rotate-[0.4deg] rounded-3xl border-[3px] border-dashed border-ink/50 bg-cream/60 p-6 sm:mt-16">
          <p className="text-xs tracking-[0.3em] uppercase text-coral-deep">
            ✦ Bonus treasure (no points, pure joy) ✦
          </p>
          <h3 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-display)" }}>
            {bonusStop.emoji} {bonusStop.name}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{bonusStop.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border-2 border-ink/20 bg-paper px-3 py-1">
              🕐 {bonusStop.hours}
            </span>
            <span className="rounded-full border-2 border-ink/20 bg-paper px-3 py-1">
              🎟️ {bonusStop.price}
            </span>
          </div>
        </aside>
      </section>

      {/* ── Tips footer ────────────────────────────────── */}
      <footer className="mt-20 rounded-3xl border-[3px] border-ink bg-paper-deep p-7 shadow-[5px_6px_0_rgba(59,47,36,0.22)] sm:p-9">
        <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
          🧭 Explorer&apos;s field notes
        </h2>
        <ul className="mt-4 grid gap-3 text-[15px] leading-relaxed sm:grid-cols-2">
          <li className="rounded-2xl bg-cream/70 p-4">
            <strong>🎫 Passes:</strong> the Go City Gothenburg pass covers most paid stops here,
            and a 150 SEK Museum Card gets you into the Art, City and Röhsska museums for a whole
            year. Under 20 or a student? Most city museums are free!
          </li>
          <li className="rounded-2xl bg-cream/70 p-4">
            <strong>🚋 Trams are your friend:</strong> the blue-and-white trams reach every stop;
            hop on one when your feet protest. Buy tickets in the Västtrafik To Go app.
          </li>
          <li className="rounded-2xl bg-cream/70 p-4">
            <strong>☕ Fika is mandatory:</strong> pause in Haga for a kanelbulle the size of your
            head at Café Husaren. This is the law (not really, but also yes).
          </li>
          <li className="rounded-2xl bg-cream/70 p-4">
            <strong>🌧️ Rain plan:</strong> this is the west coast — pack a light raincoat and wear
            the museums as shelter. They&apos;re cozier when it drizzles anyway.
          </li>
        </ul>
        <p className="mt-6 text-center text-sm text-ink-soft">
          Made with 🧡 and kanelbullar in Örgryte · Hours &amp; prices change — double-check
          official sites before you set sail.
        </p>
      </footer>
    </main>
  );
}
