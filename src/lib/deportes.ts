import { prisma } from "@/lib/prisma";

const BASE = "https://www.thesportsdb.com/api/v1/json/123";

const LEAGUES: Array<{ id: string; filters: string[] | null }> = [
  { id: "4406", filters: null },
  {
    id: "4328",
    filters: [
      "Chelsea",
      "Arsenal",
      "Manchester",
      "Liverpool",
      "Tottenham",
      "Aston",
    ],
  },
  { id: "4322", filters: ["Milan", "Inter", "Roma", "Atalanta", "Juventus"] },
  { id: "4335", filters: ["Madrid", "Barcelona"] },
  { id: "4331", filters: ["Dortmund", "Bayern"] },
  { id: "4480", filters: null },
  { id: "4501", filters: ["Boca", "River Plate", "Tucuman"] },
  { id: "4724", filters: ["Boca", "River Plate", "Tucuman"] },
  { id: "4429", filters: null },
];

const FEATURED_TEAMS: Array<{ id: string; type: string; borderColor: string }> =
  [
    { id: "152109", type: "tarucas", borderColor: "#f97316" },
    { id: "136197", type: "team136197", borderColor: "#ef4444" },
    { id: "135681", type: "team135681", borderColor: "#60a5fa" },
  ];

const LIGA_EXCLUDED = new Set(["136197", "135681"]);
const SPANISH_MONTHS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];
const LIVE_STATUSES = new Set([
  "1H",
  "2H",
  "HT",
  "ET",
  "PEN",
  "Live",
  "In Progress",
]);

interface RawEvent {
  idEvent: string;
  idLeague?: string;
  idHomeTeam?: string;
  idAwayTeam?: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
  strThumb?: string | null;
  strLeague: string;
  strLeagueBadge?: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus?: string;
  strTime?: string | null;
  strTimestamp?: string | null;
}

export interface EventCard {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  strHomeTeamBadge: string | null;
  strAwayTeamBadge: string | null;
  strThumb: string | null;
  strLeague: string;
  strLeagueBadge: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  label: string;
  labelColor: string;
  timeLocal: string | null;
  dateFormatted: string;
}

export interface FeaturedCard extends EventCard {
  type: string;
  borderColor: string;
}

export interface SportsApiResponse {
  featured: FeaturedCard[];
  events: EventCard[];
}

export interface SyncStatus {
  running: boolean;
  lastSync: Date | null;
  eventCount: number;
  featuredCount: number;
}

// ---- Helpers ----------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getUtc3Date(offsetDays = 0): string {
  const now = new Date();
  const utc3ms =
    now.getTime() - 3 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  const d = new Date(utc3ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timestampToUtc3Date(ts: string): string {
  // ts is "YYYY-MM-DD HH:MM:SS" treated as UTC
  const utcMs = new Date(ts.replace(" ", "T") + "Z").getTime();
  const local = new Date(utcMs - 3 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function utcTimeToLocal(t: string): string | null {
  // t is "HH:MM" UTC — subtract 3 hours
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const h = (parseInt(parts[0], 10) - 3 + 24) % 24;
  return `${String(h).padStart(2, "0")}:${parts[1]}`;
}

function formatDateES(d: string): string {
  // "YYYY-MM-DD" → "28 ABR"
  const [, m, day] = d.split("-");
  return `${parseInt(day, 10)} ${SPANISH_MONTHS[parseInt(m, 10) - 1]}`;
}

function getLabel(
  ev: RawEvent,
  localTime: string | null,
): { label: string; labelColor: string } {
  const status = ev.strStatus ?? "";
  if (status === "Match Finished")
    return { label: "FINALIZADO", labelColor: "#6b7280" };
  if (LIVE_STATUSES.has(status))
    return { label: "EN VIVO", labelColor: "#ef4444" };
  return { label: localTime ?? "HOY", labelColor: "#f97316" };
}

function isWithin3Days(ts: string): boolean {
  const eventDate = timestampToUtc3Date(ts);
  const today = getUtc3Date(0);
  const in3 = getUtc3Date(3);
  return eventDate >= today && eventDate <= in3;
}

function transformEvent(ev: RawEvent, localTime: string | null): EventCard {
  const ts = ev.strTimestamp ?? "";
  const { label, labelColor } = getLabel(ev, localTime);
  return {
    idEvent: ev.idEvent,
    strEvent: ev.strEvent,
    strHomeTeam: ev.strHomeTeam ?? null,
    strAwayTeam: ev.strAwayTeam ?? null,
    strHomeTeamBadge: ev.strHomeTeamBadge ?? null,
    strAwayTeamBadge: ev.strAwayTeamBadge ?? null,
    strThumb: ev.strThumb ?? null,
    strLeague: ev.strLeague,
    strLeagueBadge: ev.strLeagueBadge ?? null,
    intHomeScore: ev.intHomeScore,
    intAwayScore: ev.intAwayScore,
    label,
    labelColor,
    timeLocal: localTime,
    dateFormatted: ts ? formatDateES(timestampToUtc3Date(ts)) : "",
  };
}

// ---- HTTP fetchers ----------------------------------------------------------

async function fetchEvents(url: string): Promise<RawEvent[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events ?? []) as RawEvent[];
  } catch {
    return [];
  }
}

// ---- Sync state -------------------------------------------------------------

let _syncRunning = false;
export const isSyncRunning = () => _syncRunning;

// ---- Main orchestrator ------------------------------------------------------

export async function syncSportsData(): Promise<void> {
  if (_syncRunning) return;
  _syncRunning = true;

  try {
    const today = getUtc3Date(0);
    const tomorrow = getUtc3Date(1);

    // Build ordered URL list:
    //   indices 0-17 → league × date (9 leagues × 2 dates)
    //   indices 18-20 → featured teams
    //   index 21 → F1
    const urls: string[] = [
      ...LEAGUES.flatMap((l) => [
        `${BASE}/eventsday.php?d=${today}&l=${l.id}`,
        `${BASE}/eventsday.php?d=${tomorrow}&l=${l.id}`,
      ]),
      ...FEATURED_TEAMS.map((t) => `${BASE}/eventsnext.php?id=${t.id}`),
      `${BASE}/eventsnextleague.php?id=4370`,
    ];

    // Sequential fetch — 1 second between each request
    const results: RawEvent[][] = [];
    for (let i = 0; i < urls.length; i++) {
      results.push(await fetchEvents(urls[i]));
      if (i < urls.length - 1) await sleep(1000);
    }

    // --- Regular league events (indices 0-17) ---
    const events: EventCard[] = [];
    for (let i = 0; i < LEAGUES.length * 2; i++) {
      const leagueIdx = Math.floor(i / 2);
      const league = LEAGUES[leagueIdx];

      for (const ev of results[i]) {
        if (!ev.strTimestamp) continue;
        if (timestampToUtc3Date(ev.strTimestamp) !== today) continue;

        // Argentine Liga: exclude featured team matches
        if (league.id === "4406") {
          const homeId = ev.idHomeTeam ?? "";
          const awayId = ev.idAwayTeam ?? "";
          if (LIGA_EXCLUDED.has(homeId) || LIGA_EXCLUDED.has(awayId)) continue;
        }

        // Per-league team name filter
        if (league.filters) {
          const combined = `${ev.strHomeTeam} ${ev.strAwayTeam}`;
          if (!league.filters.some((f) => combined.includes(f))) continue;
        }

        const localTime = ev.strTime ? utcTimeToLocal(ev.strTime) : null;
        events.push(transformEvent(ev, localTime));
      }
    }

    events.sort((a, b) => (a.timeLocal ?? "").localeCompare(b.timeLocal ?? ""));

    // --- Featured cards (indices 16-18 = teams, 19 = F1) ---
    const featured: FeaturedCard[] = [];

    for (let i = 0; i < FEATURED_TEAMS.length; i++) {
      const ev = results[LEAGUES.length * 2 + i]?.[0];
      if (!ev?.strTimestamp || !isWithin3Days(ev.strTimestamp)) continue;
      const localTime = ev.strTime ? utcTimeToLocal(ev.strTime) : null;
      featured.push({
        ...transformEvent(ev, localTime),
        type: FEATURED_TEAMS[i].type,
        borderColor: FEATURED_TEAMS[i].borderColor,
      });
    }

    const f1ev = results[LEAGUES.length * 2 + FEATURED_TEAMS.length]?.[0];
    if (f1ev?.strTimestamp && isWithin3Days(f1ev.strTimestamp)) {
      const localTime = f1ev.strTime ? utcTimeToLocal(f1ev.strTime) : null;
      featured.push({
        ...transformEvent(f1ev, localTime),
        type: "f1",
        borderColor: "#ef4444",
      });
    }

    // --- Atomic DB replace ---
    const now = new Date();
    await prisma.$transaction([
      prisma.sportsEvent.deleteMany(),
      prisma.sportsFeatured.deleteMany(),
      prisma.sportsEvent.createMany({
        data: events.map((e) => ({ ...e, synced_at: now })),
      }),
      prisma.sportsFeatured.createMany({
        data: featured.map((e) => ({ ...e, synced_at: now })),
      }),
    ]);
  } finally {
    _syncRunning = false;
  }
}

// ---- DB reads ---------------------------------------------------------------

export async function getSportsForApi(): Promise<SportsApiResponse> {
  const [featured, events] = await Promise.all([
    prisma.sportsFeatured.findMany({ orderBy: { id: "asc" } }),
    prisma.sportsEvent.findMany({
      orderBy: [{ timeLocal: "asc" }, { id: "asc" }],
    }),
  ]);
  return { featured, events };
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const [eventCount, featuredCount, lastEvent] = await Promise.all([
    prisma.sportsEvent.count(),
    prisma.sportsFeatured.count(),
    prisma.sportsEvent.findFirst({
      orderBy: { synced_at: "desc" },
      select: { synced_at: true },
    }),
  ]);
  return {
    running: _syncRunning,
    lastSync: lastEvent?.synced_at ?? null,
    eventCount,
    featuredCount,
  };
}

export async function getAllSportsForAdmin(): Promise<SportsApiResponse> {
  const [featured, events] = await Promise.all([
    prisma.sportsFeatured.findMany({ orderBy: { id: "asc" } }),
    prisma.sportsEvent.findMany({
      orderBy: [{ strLeague: "asc" }, { timeLocal: "asc" }],
    }),
  ]);
  return { featured, events };
}
