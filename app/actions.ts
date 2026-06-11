"use server";

import { put } from "@vercel/blob";
import { createClient } from "@vercel/kv";
import sharp from "sharp";
import {
  defaultTeams,
  MAX_TEAMS,
  stops,
  teamFlavors,
  type Claim,
  type HuntClaims,
  type HuntEvent,
  type HuntPhotos,
  type StoredPhoto,
  type Team,
} from "./stops";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EVENTS = 100;

// Vercel KV exposes KV_*; the Upstash marketplace integration exposes UPSTASH_*.
const kvUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const kv = kvUrl && kvToken ? createClient({ url: kvUrl, token: kvToken }) : null;
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

// Local-dev fallbacks so every flow works without cloud credentials.
// On Vercel the real stores are used; these maps only live per server process.
const memoryAlbums = new Map<string, Record<string, StoredPhoto>>();
const memoryTeams = new Map<string, Team[]>();
const memoryEvents = new Map<string, HuntEvent[]>();
const memoryClaims = new Map<string, HuntClaims>();

/** Hunt-local date (Europe/Stockholm), e.g. "2026-06-13" — part of every KV key. */
function stockholmDate(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
}

const albumKey = (teamId: string) => `photos:${teamId}:${stockholmDate()}`;
const teamsKey = () => `teams:${stockholmDate()}`;
const eventsKey = () => `events:${stockholmDate()}`;
const claimsKey = () => `claims:${stockholmDate()}`;

async function readClaims(): Promise<HuntClaims> {
  if (kv) return ((await kv.hgetall<HuntClaims>(claimsKey())) ?? {}) as HuntClaims;
  return memoryClaims.get(claimsKey()) ?? {};
}

/** Claim a stop for a team if nobody has it yet. Returns the winning claim. */
async function claimStop(stopId: string, teamId: string): Promise<{ claim: Claim; isNew: boolean }> {
  const claim: Claim = { teamId, at: Date.now() };
  if (kv) {
    const won = await kv.hsetnx(claimsKey(), stopId, claim);
    if (won === 1) return { claim, isNew: true };
    const existing = await kv.hget<Claim>(claimsKey(), stopId);
    return { claim: existing ?? claim, isNew: false };
  }
  const all = memoryClaims.get(claimsKey()) ?? {};
  if (all[stopId]) return { claim: all[stopId], isNew: false };
  all[stopId] = claim;
  memoryClaims.set(claimsKey(), all);
  return { claim, isNew: true };
}

async function readTeams(): Promise<Team[]> {
  let saved: Team[] | null = null;
  if (kv) saved = await kv.get<Team[]>(teamsKey());
  else saved = memoryTeams.get(teamsKey()) ?? null;
  return saved && saved.length > 0 ? saved : defaultTeams;
}

async function writeTeams(teams: Team[]): Promise<void> {
  if (kv) await kv.set(teamsKey(), teams);
  else memoryTeams.set(teamsKey(), teams);
}

async function logEvent(teamId: string, message: string): Promise<void> {
  const event: HuntEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    teamId,
    message,
    at: Date.now(),
  };
  if (kv) {
    await kv.lpush(eventsKey(), event);
    await kv.ltrim(eventsKey(), 0, MAX_EVENTS - 1);
  } else {
    const list = memoryEvents.get(eventsKey()) ?? [];
    list.unshift(event);
    memoryEvents.set(eventsKey(), list.slice(0, MAX_EVENTS));
  }
}

async function readEvents(): Promise<HuntEvent[]> {
  if (kv) return (await kv.lrange<HuntEvent>(eventsKey(), 0, MAX_EVENTS - 1)) ?? [];
  return memoryEvents.get(eventsKey()) ?? [];
}

async function readAllPhotos(teams: Team[]): Promise<HuntPhotos> {
  const result: HuntPhotos = {};
  for (const team of teams) {
    try {
      if (kv) {
        const album = await kv.hgetall<Record<string, StoredPhoto>>(albumKey(team.id));
        result[team.id] = album ?? {};
      } else {
        result[team.id] = memoryAlbums.get(albumKey(team.id)) ?? {};
      }
    } catch (err) {
      console.error(`readAllPhotos failed for ${team.id}`, err);
      result[team.id] = {};
    }
  }
  return result;
}

export type HuntState = {
  teams: Team[];
  photos: HuntPhotos;
  events: HuntEvent[];
  claims: HuntClaims;
};

/** One call for the minute-by-minute polling loop. */
export async function getHuntState(): Promise<HuntState> {
  try {
    const teams = await readTeams();
    const [photos, events, claims] = await Promise.all([
      readAllPhotos(teams),
      readEvents(),
      readClaims(),
    ]);
    return { teams, photos, events, claims };
  } catch (err) {
    console.error("getHuntState failed", err);
    return { teams: defaultTeams, photos: {}, events: [], claims: {} };
  }
}

export async function createTeam(rawName: string): Promise<{
  ok: boolean;
  team?: Team;
  teams?: Team[];
  error?: string;
}> {
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, 24);
  if (name.length < 2) return { ok: false, error: "Give your team a name (2+ characters)." };

  try {
    const teams = await readTeams();
    if (teams.length >= MAX_TEAMS) return { ok: false, error: `Max ${MAX_TEAMS} teams — the hunt is full!` };

    const id = name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (!id) return { ok: false, error: "That name needs at least one letter or number." };
    if (teams.some((t) => t.id === id)) return { ok: false, error: "A team with that name already exists." };

    const flavor = teamFlavors[teams.length % teamFlavors.length];
    const team: Team = { id, name, emoji: flavor.emoji, color: flavor.color, tagline: flavor.tagline };
    const next = [...teams, team];
    await writeTeams(next);
    await logEvent(id, `${team.emoji} ${team.name} joined the hunt!`);
    return { ok: true, team, teams: next };
  } catch (err) {
    console.error("createTeam failed", err);
    return { ok: false, error: "Could not create the team — try again." };
  }
}

export async function uploadFindPhoto(formData: FormData): Promise<{
  ok: boolean;
  url?: string;
  /** true if this photo claimed the place's point (first team there) */
  claimed?: boolean;
  /** when not claimed: which team beat you to it */
  claimedByTeamId?: string;
  error?: string;
}> {
  const file = formData.get("photo");
  const teamId = formData.get("teamId");
  const stopId = formData.get("stopId");

  if (!(file instanceof File) || typeof teamId !== "string" || typeof stopId !== "string") {
    return { ok: false, error: "Missing photo, team or stop." };
  }
  const teams = await readTeams();
  const team = teams.find((t) => t.id === teamId);
  if (!team) return { ok: false, error: "Unknown team." };
  const stop = stops.find((s) => s.id === stopId);
  if (!stop) return { ok: false, error: "Unknown stop." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Not an image." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Photo too large." };

  try {
    const original = Buffer.from(await file.arrayBuffer());
    const compressed = await sharp(original)
      .rotate() // respect EXIF orientation
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();

    let url: string;
    if (hasBlob) {
      const blob = await put(`hunt/${stockholmDate()}/${teamId}/${stopId}.jpg`, compressed, {
        access: "public",
        addRandomSuffix: true,
        contentType: "image/jpeg",
      });
      url = blob.url;
    } else {
      // dev fallback: inline the (small) compressed image
      url = `data:image/jpeg;base64,${compressed.toString("base64")}`;
    }

    const photo: StoredPhoto = { url, uploadedAt: Date.now() };
    if (kv) {
      await kv.hset(albumKey(teamId), { [stopId]: photo });
    } else {
      const album = memoryAlbums.get(albumKey(teamId)) ?? {};
      album[stopId] = photo;
      memoryAlbums.set(albumKey(teamId), album);
    }

    // the point goes to whoever photographed this place FIRST
    const { claim, isNew } = await claimStop(stopId, teamId);
    if (isNew) {
      const claims = await readClaims();
      const points = Object.values(claims).filter((c) => c.teamId === teamId).length;
      const allClaimed = Object.keys(claims).length >= stops.length;
      await logEvent(
        teamId,
        `${team.emoji} ${team.name} got a point — first at ${stop.emoji} ${stop.name}! (${points} pts)`
      );
      if (allClaimed) {
        await logEvent(teamId, `🏁 Every place has been claimed — the race is decided!`);
      }
    }

    return {
      ok: true,
      url,
      claimed: isNew,
      claimedByTeamId: isNew ? undefined : claim.teamId,
    };
  } catch (err) {
    console.error("uploadFindPhoto failed", err);
    return { ok: false, error: "Upload failed — try again." };
  }
}
