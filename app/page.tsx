"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TreasureMap from "./TreasureMap";
import TeamAlbum from "./TeamAlbum";
import HuntOverview from "./HuntOverview";
import { createTeam, getHuntState, uploadFindPhoto } from "./actions";
import {
  bonusStop,
  defaultTeams,
  huntSchedule,
  MAX_TEAMS,
  routeIntro,
  stops,
  type HuntClaims,
  type HuntEvent,
  type HuntPhotos,
  type Team,
} from "./stops";

const STORAGE_KEY = "gbg-treasure-hunt-v2";

type TeamProgress = {
  found: string[];
  startedAt: number | null;
  finishedAt: number | null;
};

type ProgressMap = Record<string, TeamProgress>;

const emptyProgress = (): TeamProgress => ({ found: [], startedAt: null, finishedAt: null });

type Toast = { id: string; message: string };

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type HuntPhase = "before" | "during" | "after";

/** Shrink a camera photo client-side so uploads stay well under serverless limits. */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8)
    );
  } catch {
    return file; // let the server compress instead
  }
}

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
      const { startUtcMs, endUtcMs } = huntSchedule;
      if (now < startUtcMs) setState({ phase: "before", label: fmt(startUtcMs - now) });
      else if (now < endUtcMs) setState({ phase: "during", label: fmt(endUtcMs - now) });
      else setState({ phase: "after", label: "00:00:00" });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return state;
}

export default function Home() {
  const [hunt, setHunt] = useState<ProgressMap>({});
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(true);
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const [teamList, setTeamList] = useState<Team[]>(defaultTeams);
  const [photos, setPhotos] = useState<HuntPhotos>({});
  const [events, setEvents] = useState<HuntEvent[]>([]);
  const [claims, setClaims] = useState<HuntClaims>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [uploadingStop, setUploadingStop] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ stopId: string; message: string } | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{
    stopId: string;
    file: File;
    previewUrl: string;
  } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingStopRef = useRef<string | null>(null);
  const seenEventsRef = useRef<Set<string>>(new Set());
  const firstPollRef = useRef(true);
  const countdown = useHuntCountdown();
  const phase: HuntPhase = countdown?.phase ?? "before";

  // hydrate local progress from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { hunt: ProgressMap; activeTeamId: string | null };
        setHunt(saved.hunt ?? {});
        if (saved.activeTeamId) {
          setActiveTeamId(saved.activeTeamId);
          setSelectorOpen(false);
        }
      }
    } catch {
      // fresh start
    }
  }, []);

  /** Passive background poll: teams, photos and the event timeline, once a minute. */
  const refreshHuntState = useCallback(async () => {
    try {
      const state = await getHuntState();
      setTeamList(state.teams);
      setPhotos(state.photos);
      setEvents(state.events);
      setClaims(state.claims);
      const seen = seenEventsRef.current;
      if (firstPollRef.current) {
        // history isn't news — don't toast what happened before this page opened
        state.events.forEach((e) => seen.add(e.id));
        firstPollRef.current = false;
        return;
      }
      const fresh = state.events.filter((e) => !seen.has(e.id));
      if (fresh.length === 0) return;
      fresh.forEach((e) => seen.add(e.id));
      setToasts((prev) => [...prev, ...fresh.map((e) => ({ id: e.id, message: e.message }))]);
      for (const e of fresh) {
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== e.id)), 6000);
      }
    } catch {
      // offline — next tick will retry
    }
  }, []);

  useEffect(() => {
    refreshHuntState();
    const id = setInterval(refreshHuntState, 60_000);
    return () => clearInterval(id);
  }, [refreshHuntState]);

  // if the active team isn't part of today's hunt (new day, team list reset), re-ask
  useEffect(() => {
    if (activeTeamId && !firstPollRef.current && !teamList.some((t) => t.id === activeTeamId)) {
      setActiveTeamId(null);
      setSelectorOpen(true);
    }
  }, [teamList, activeTeamId]);

  const persist = useCallback((nextHunt: ProgressMap, nextActive: string | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hunt: nextHunt, activeTeamId: nextActive }));
    } catch {
      // storage blocked — progress just won't persist
    }
  }, []);

  const chooseTeam = useCallback(
    (id: string) => {
      setHunt((prev) => {
        const current = prev[id] ?? emptyProgress();
        const next = {
          ...prev,
          [id]: current.startedAt ? current : { ...current, startedAt: Date.now() },
        };
        persist(next, id);
        return next;
      });
      setActiveTeamId(id);
      setSelectorOpen(false);
    },
    [persist]
  );

  const submitNewTeam = async () => {
    setCreatingTeam(true);
    setCreateError(null);
    try {
      const res = await createTeam(newTeamName);
      if (!res.ok || !res.team) {
        setCreateError(res.error ?? "Could not create the team — try again.");
        return;
      }
      if (res.teams) setTeamList(res.teams);
      chooseTeam(res.team.id);
      setNewTeamName("");
      setShowCreateForm(false);
      refreshHuntState();
    } finally {
      setCreatingTeam(false);
    }
  };

  const toggleFound = (stopId: string) => {
    if (!activeTeamId) {
      setSelectorOpen(true);
      return;
    }
    setHunt((prev) => {
      const team = prev[activeTeamId] ?? emptyProgress();
      const foundSet = new Set(team.found);
      if (foundSet.has(stopId)) foundSet.delete(stopId);
      else foundSet.add(stopId);
      const done = foundSet.size === stops.length;
      const next: ProgressMap = {
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

  /** Marking a fresh find requires a proof photo; un-marking and re-marking don't. */
  const requestFound = (stopId: string) => {
    if (phase === "after") return; // points are locked once the hunt is over
    if (!activeTeamId) {
      setSelectorOpen(true);
      return;
    }
    const isFound = (hunt[activeTeamId]?.found ?? []).includes(stopId);
    const hasPhoto = !!photos[activeTeamId]?.[stopId];
    if (isFound || hasPhoto) {
      toggleFound(stopId);
      return;
    }
    setUploadError(null);
    pendingStopRef.current = stopId;
    fileInputRef.current?.click();
  };

  /** A photo was picked (camera or library) — stage it for confirmation, don't post yet. */
  const onPhotoChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    const stopId = pendingStopRef.current;
    pendingStopRef.current = null;
    if (!file || !stopId || !activeTeamId) return;
    if (!file.type.startsWith("image/")) {
      setUploadError({ stopId, message: "That file isn't an image — try again." });
      return;
    }
    setUploadError(null);
    setPendingPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { stopId, file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const discardPendingPhoto = () => {
    setPendingPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  /** Re-open the picker for the same stop. */
  const retakePendingPhoto = () => {
    const stopId = pendingPhoto?.stopId;
    discardPendingPhoto();
    if (!stopId) return;
    pendingStopRef.current = stopId;
    fileInputRef.current?.click();
  };

  /** User confirmed the preview — now compress, post and (maybe) claim the point. */
  const confirmSharePhoto = async () => {
    if (!pendingPhoto || !activeTeamId) return;
    const { stopId, file } = pendingPhoto;
    setUploadingStop(stopId);
    setUploadError(null);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("photo", new File([compressed], `${stopId}.jpg`, { type: "image/jpeg" }));
      fd.append("teamId", activeTeamId);
      fd.append("stopId", stopId);
      const res = await uploadFindPhoto(fd);
      if (!res.ok || !res.url) {
        setUploadError({ stopId, message: res.error ?? "Upload failed — try again." });
        return; // keep the preview open so they can retry or cancel
      }
      discardPendingPhoto();
      const url = res.url;
      setPhotos((prev) => ({
        ...prev,
        [activeTeamId]: {
          ...(prev[activeTeamId] ?? {}),
          [stopId]: { url, uploadedAt: Date.now() },
        },
      }));
      toggleFound(stopId);
      if (res.claimed === false) {
        const rival = teamList.find((t) => t.id === res.claimedByTeamId);
        const id = `local-${Date.now()}`;
        setToasts((prev) => [
          ...prev,
          {
            id,
            message: `📸 Photo saved — but ${rival ? `${rival.emoji} ${rival.name}` : "another team"} was here first. No point!`,
          },
        ]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
      }
      refreshHuntState();
    } catch {
      setUploadError({ stopId, message: "Upload failed — check your connection and try again." });
    } finally {
      setUploadingStop(null);
    }
  };

  const scrollToStop = (id: string) => {
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const activeTeam: Team | null = teamList.find((t) => t.id === activeTeamId) ?? null;
  const activeFound = useMemo(
    () => new Set(activeTeamId ? hunt[activeTeamId]?.found ?? [] : []),
    [hunt, activeTeamId]
  );

  // standings: a place's point belongs to whoever photographed it FIRST (server claims)
  const standings = useMemo(() => {
    const counts = new Map<string, { points: number; lastAt: number }>(
      teamList.map((t) => [t.id, { points: 0, lastAt: 0 }])
    );
    for (const claim of Object.values(claims)) {
      const entry = counts.get(claim.teamId);
      if (!entry) continue;
      entry.points += 1;
      entry.lastAt = Math.max(entry.lastAt, claim.at);
    }
    return teamList
      .map((t) => {
        const entry = counts.get(t.id) as { points: number; lastAt: number };
        return { team: t, points: entry.points, lastAt: entry.lastAt };
      })
      .sort((a, b) => b.points - a.points || a.lastAt - b.lastAt);
  }, [claims, teamList]);

  // winner: announced the moment a lead becomes unbeatable, or at the 18:00 whistle
  const winner = useMemo(() => {
    const leader = standings[0];
    if (!leader || leader.points === 0) return null;
    const unclaimed = stops.length - Object.keys(claims).length;
    const bestPossibleChase = (standings[1]?.points ?? 0) + unclaimed;
    if (leader.points > bestPossibleChase) return leader;
    if (phase === "after") return leader;
    return null;
  }, [standings, claims, phase]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-8">
      {/* hidden photo input — no `capture` attr, so phones offer BOTH camera and photo library */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onPhotoChosen}
      />

      {/* ── Photo preview: confirm before posting ──────── */}
      {pendingPhoto &&
        (() => {
          const stop = stops.find((s) => s.id === pendingPhoto.stopId);
          const isPosting = uploadingStop === pendingPhoto.stopId;
          return (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Confirm photo before sharing"
            >
              <div className="pop-in my-8 w-full max-w-md rounded-3xl border-4 border-ink bg-paper p-6 text-center shadow-[8px_10px_0_rgba(59,47,36,0.4)]">
                <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
                  📸 Ok to share?
                </h2>
                <p className="mt-2 text-sm text-ink-soft">
                  This photo will be posted to {activeTeam?.emoji} {activeTeam?.name}&apos;s album
                  for everyone to see{stop ? ` — and could claim the point at ${stop.emoji} ${stop.name}!` : "."}
                </p>
                {/* polaroid preview */}
                <div className="mx-auto mt-4 w-fit rotate-[-1.5deg] rounded-xl border-[3px] border-ink bg-cream p-2 pb-6 shadow-[4px_5px_0_rgba(59,47,36,0.25)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingPhoto.previewUrl}
                    alt="Preview of your proof photo"
                    className="max-h-[45vh] w-auto max-w-full rounded-lg object-contain"
                  />
                </div>
                {uploadError?.stopId === pendingPhoto.stopId && (
                  <p className="mt-3 text-sm font-bold text-coral-deep" role="alert">
                    ⚠️ {uploadError.message}
                  </p>
                )}
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={confirmSharePhoto}
                    disabled={isPosting}
                    className={`w-full rounded-full border-[3px] border-ink bg-gold px-4 py-2.5 font-bold shadow-[3px_4px_0_rgba(59,47,36,0.3)] ${
                      isPosting
                        ? "cursor-wait opacity-70"
                        : "cursor-pointer hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
                    }`}
                  >
                    {isPosting ? "📤 Posting…" : "✅ Share it — go for the point!"}
                  </button>
                  <button
                    type="button"
                    onClick={retakePendingPhoto}
                    disabled={isPosting}
                    className="w-full cursor-pointer rounded-full border-[3px] border-ink bg-cream px-4 py-2.5 font-bold hover:bg-paper-deep disabled:cursor-wait disabled:opacity-70"
                  >
                    📷 Choose another
                  </button>
                  <button
                    type="button"
                    onClick={discardPendingPhoto}
                    disabled={isPosting}
                    className="w-full cursor-pointer rounded-full border-2 border-ink/30 px-4 py-2 text-sm text-ink-soft hover:bg-cream disabled:cursor-wait disabled:opacity-70"
                  >
                    Cancel — nothing is posted
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── Toasts: live hunt updates ──────────────────── */}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <p
            key={t.id}
            role="status"
            className="pop-in w-full rounded-full border-[3px] border-ink bg-cream px-5 py-2.5 text-center text-sm font-bold shadow-[3px_4px_0_rgba(59,47,36,0.3)]"
          >
            {t.message}
          </p>
        ))}
      </div>

      {/* ── Notification bell + timeline ───────────────── */}
      <button
        type="button"
        onClick={() => setTimelineOpen(true)}
        aria-label={`Open hunt timeline (${events.length} updates)`}
        className="fixed top-4 right-4 z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-[3px] border-ink bg-cream text-xl shadow-[3px_4px_0_rgba(59,47,36,0.3)] transition-transform hover:scale-110"
      >
        🔔
        {events.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-ink bg-coral px-1 text-xs font-bold text-cream">
            {events.length > 99 ? "99+" : events.length}
          </span>
        )}
      </button>

      {timelineOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Hunt timeline"
          onClick={() => setTimelineOpen(false)}
        >
          <div
            className="pop-in my-8 w-full max-w-md rounded-3xl border-4 border-ink bg-paper p-6 shadow-[8px_10px_0_rgba(59,47,36,0.4)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
                🔔 Hunt timeline
              </h2>
              <button
                type="button"
                onClick={() => setTimelineOpen(false)}
                aria-label="Close timeline"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-ink bg-cream font-bold hover:bg-paper-deep"
              >
                ✕
              </button>
            </div>
            {events.length === 0 ? (
              <p className="mt-4 text-center text-ink-soft">
                Nothing yet — updates appear here as teams join and find treasures!
              </p>
            ) : (
              <ul className="mt-4 grid max-h-[60vh] gap-2 overflow-y-auto">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-baseline gap-3 rounded-2xl border-2 border-ink/20 bg-cream px-4 py-2.5 text-sm"
                  >
                    <span className="shrink-0 font-bold tabular-nums text-ink-soft">
                      {formatClock(e.at)}
                    </span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
              Pick your team!
            </h2>
            <p className="mt-2 text-center text-sm text-ink-soft">
              Up to {MAX_TEAMS} teams race for the same {`${stops.length} treasures`}. Join one —
              or create your own. The first photo at each place claims its point; most points by{" "}
              {huntSchedule.endLabel} wins!
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {teamList.map((t) => {
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
                        <p className="text-xs text-ink-soft">{t.tagline}</p>
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

            {teamList.length < MAX_TEAMS &&
              (showCreateForm ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitNewTeam();
                  }}
                  className="mt-4 rounded-2xl border-[3px] border-dashed border-ink/50 bg-cream p-4"
                >
                  <label htmlFor="new-team-name" className="text-sm font-bold">
                    Name your team
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="new-team-name"
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="e.g. Team Älg"
                      maxLength={24}
                      autoFocus
                      className="min-w-0 flex-1 rounded-full border-2 border-ink bg-paper px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gold-deep"
                    />
                    <button
                      type="submit"
                      disabled={creatingTeam}
                      className={`shrink-0 rounded-full border-[3px] border-ink bg-gold px-4 py-2 text-sm font-bold shadow-[2px_3px_0_rgba(59,47,36,0.3)] ${
                        creatingTeam ? "cursor-wait opacity-70" : "cursor-pointer hover:-translate-y-0.5"
                      }`}
                    >
                      {creatingTeam ? "Creating…" : "Create & join"}
                    </button>
                  </div>
                  {createError && (
                    <p className="mt-2 text-sm font-bold text-coral-deep" role="alert">
                      ⚠️ {createError}
                    </p>
                  )}
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="mt-4 w-full cursor-pointer rounded-full border-[3px] border-dashed border-ink/60 bg-cream px-4 py-2.5 font-bold text-ink hover:bg-paper-deep"
                >
                  ➕ Create new team ({teamList.length}/{MAX_TEAMS})
                </button>
              ))}

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

      {/* ── Winner announcement (overview handles the post-18:00 celebration) ── */}
      {winner && !winnerDismissed && phase !== "after" && (
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
              An unbeatable lead — no other team can catch them now!
            </p>
            <p
              className="mt-4 rounded-2xl border-2 border-dashed border-gold-deep bg-cream px-4 py-3 text-2xl"
              style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}
            >
              🏴 First at {winner.points} of {stops.length} places
            </p>
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
          {`${stops.length} treasures`} from our doorstep in Örgryte to the lights of Liseberg.
          Grab your team — follow the story, tick off the finds, beat the clock!
        </p>
      </header>

      {/* ── How it works — briefing for the crew ───────── */}
      <section
        aria-label="How the hunt works"
        className="pop-in mx-auto mb-8 max-w-2xl"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="rotate-[0.3deg] rounded-3xl border-[3px] border-ink bg-paper-deep px-6 py-5 shadow-[5px_6px_0_rgba(59,47,36,0.25)] sm:px-8 sm:py-6">
          <h2 className="text-center text-3xl" style={{ fontFamily: "var(--font-display)" }}>
            📜 How the hunt works
          </h2>
          <ul className="mt-4 grid gap-2.5 text-[15px] leading-relaxed sm:grid-cols-2">
            <li className="rounded-2xl bg-cream/80 p-3.5">
              <strong>🕙 Kickoff {huntSchedule.startLabel}</strong> — we all meet at Örgryte Old
              Church (chapter 1, our doorstep) on {huntSchedule.dayLabel}. The map and clues below
              stay sealed until then!
            </li>
            <li className="rounded-2xl bg-cream/80 p-3.5">
              <strong>🏴 One winner per place</strong> — the FIRST team to upload a proof photo at
              a place claims its point, forever. Most points when the {huntSchedule.endLabel}{" "}
              deadline hits at Liseberg wins the hunt!
            </li>
            <li className="rounded-2xl bg-cream/80 p-3.5">
              <strong>👥 Up to {MAX_TEAMS} teams</strong> — join a team or create your own in the
              team selector on your own phone. Finds save automatically, the scoreboard tracks
              every crew, and live updates pop in as they happen (tap 🔔 for the full timeline).
            </li>
            <li className="rounded-2xl bg-cream/80 p-3.5">
              <strong>🔎 At every stop</strong> — solve the clue, snap a team photo as proof, then
              tap &quot;Mark as found&quot;. No photo, no point — and second place gets a lovely
              photo but zero points!
            </li>
            <li className="rounded-2xl bg-cream/80 p-3.5">
              <strong>⏰ Some museums open ~11</strong> — outdoor treasures (the church, Haga, the
              graffiti dragon, Feskekôrka) are fair game from kickoff, so plan your route wisely.
            </li>
            <li className="rounded-2xl bg-cream/80 p-3.5">
              <strong>🚋 Trams allowed</strong> — it&apos;s ~12 km on foot; clever tram moves are
              part of the game. Tickets in the Västtrafik To Go app.
            </li>
          </ul>
        </div>
      </section>

      {/* ── Post-hunt overview: standings + celebration + photo library ── */}
      {phase === "after" && <HuntOverview photos={photos} standings={standings} />}

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
                ? `🏁 Reach Liseberg by ${huntSchedule.endLabel} — time left:`
                : countdown?.phase === "after"
                  ? "🌙 The hunt is over — see you at Liseberg!"
                  : `⏳ The hunt begins ${huntSchedule.dayLabel} at ${huntSchedule.startLabel}`}
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
                ? `hours : minutes : seconds until the ${huntSchedule.endLabel} deadline`
                : countdown?.phase === "after"
                  ? "hope everyone found their treasures!"
                  : "hours : minutes : seconds until kickoff at Örgryte Old Church"}
            </p>
          </div>

          <p className="mt-4 text-center text-xs text-ink-soft">
            🏴 One point per place — first photo there claims it!
          </p>
          <ul className="mt-3 grid gap-2.5">
            {standings.map(({ team: t, points }) => {
              const isActive = t.id === activeTeamId;
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
                      <span className="shrink-0 text-xs font-bold text-ink-soft">
                        {points} {points === 1 ? "pt" : "pts"}
                      </span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-ink/60 bg-paper-deep">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${(points / stops.length) * 100}%`,
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
            🔄 Switch or create team
          </button>
        </div>
      </section>

      {/* ── Sealed until kickoff / Map + stops ─────────── */}
      {phase === "before" ? (
        <section
          aria-label="The map is sealed"
          className="pop-in mx-auto max-w-2xl"
          style={{ animationDelay: "0.3s" }}
        >
          <div className="rotate-[-0.4deg] rounded-3xl border-4 border-dashed border-ink bg-cream px-6 py-12 text-center shadow-[6px_8px_0_rgba(59,47,36,0.22)] sm:px-10">
            <p className="text-6xl">
              <span className="animate-bob inline-block">🗺️</span>
              <span className="mx-2 text-5xl">🔒</span>
            </p>
            <h2 className="mt-4 text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              The map is sealed!
            </h2>
            <p className="mx-auto mt-4 max-w-md text-ink-soft">
              {`${stops.length} treasures`} are hidden across Göteborg, but no peeking — the map
              and all the clues reveal themselves right here when the countdown hits zero at{" "}
              {huntSchedule.startLabel} on {huntSchedule.dayLabel}.
            </p>
            <p
              className="mt-5 text-2xl text-coral-deep"
              style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}
            >
              Rest up, hunters — Saturday we ride (trams). 🚋
            </p>
          </div>
        </section>
      ) : (
        <>
          {/* ── Map ────────────────────────────────────── */}
          <section aria-label="Treasure map" className="pop-in" style={{ animationDelay: "0.3s" }}>
            <div className="rotate-[-0.4deg] drop-shadow-[8px_10px_0_rgba(59,47,36,0.18)]">
              <TreasureMap stops={stops} found={activeFound} onSelect={scrollToStop} />
            </div>
            <p className="mt-4 text-center text-sm text-ink-soft">
              (Not to scale — drawn by a very enthusiastic cartographer. Tap a pin to read its
              clue!)
            </p>
          </section>

          {/* ── Team photo albums (each appears once that team has proofs) ── */}
          {phase === "during" &&
            teamList.map((t) => <TeamAlbum key={t.id} team={t} album={photos[t.id]} />)}

          {/* ── Stops ──────────────────────────────────── */}
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

                    {(() => {
                      const claim = claims[stop.id];
                      const claimTeam = claim
                        ? teamList.find((t) => t.id === claim.teamId)
                        : undefined;
                      return claim ? (
                        <p
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold"
                          style={{ background: claimTeam?.color ?? "var(--paper)" }}
                        >
                          🏴 Point claimed: {claimTeam ? `${claimTeam.emoji} ${claimTeam.name}` : "another team"}{" "}
                          · {formatClock(claim.at)}
                        </p>
                      ) : (
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-ink/40 bg-paper px-3 py-1 text-xs font-bold text-ink-soft">
                          ⚡ Unclaimed — first photo wins the point!
                        </p>
                      );
                    })()}

                    {activeTeamId && photos[activeTeamId]?.[stop.id] && (
                      <div className="mt-4 flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photos[activeTeamId][stop.id].url}
                          alt={`Proof photo for ${stop.name}`}
                          className="h-20 w-20 rotate-2 rounded-xl border-[3px] border-ink object-cover shadow-[2px_3px_0_rgba(59,47,36,0.25)]"
                        />
                        <p
                          className="text-blue"
                          style={{ fontFamily: "var(--font-hand)", fontSize: "1.15rem", fontWeight: 600 }}
                        >
                          📸 proof secured!
                        </p>
                      </div>
                    )}

                    {uploadError?.stopId === stop.id && (
                      <p className="mt-3 text-sm font-bold text-coral-deep" role="alert">
                        ⚠️ {uploadError.message}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => requestFound(stop.id)}
                      disabled={uploadingStop !== null || phase === "after"}
                      aria-pressed={isFound}
                      className={`mt-5 w-full rounded-full border-[3px] border-ink px-4 py-2.5 text-base font-bold transition-all duration-200 active:translate-y-0.5 active:shadow-none ${
                        phase === "after"
                          ? "cursor-not-allowed opacity-60"
                          : uploadingStop !== null
                            ? "cursor-wait opacity-70"
                            : "cursor-pointer"
                      } ${
                        isFound
                          ? "bg-park-deep text-cream shadow-[3px_4px_0_rgba(59,47,36,0.3)]"
                          : "bg-gold text-ink shadow-[3px_4px_0_rgba(59,47,36,0.3)] hover:-translate-y-0.5"
                      }`}
                    >
                      {uploadingStop === stop.id
                        ? "📤 Saving proof photo…"
                        : isFound
                          ? "⭐ Treasure found!"
                          : phase === "after"
                            ? "🌙 Hunt over — points locked"
                            : activeTeam
                              ? activeTeamId && photos[activeTeamId]?.[stop.id]
                                ? `Mark as found for ${activeTeam.emoji} ${activeTeam.name}`
                                : `📸 Snap proof & mark found (${activeTeam.emoji} ${activeTeam.name})`
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
        </>
      )}

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
