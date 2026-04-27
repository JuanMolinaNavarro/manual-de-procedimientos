import { prisma } from "@/lib/prisma";
import { fetchAllVods } from "@/lib/mwproxy";
import { searchMovies, getMovieById } from "@/lib/omdb";
import { getFanartForMovie, pickMostLiked } from "@/lib/fanart";
import { upsertOnDemand } from "@/lib/on-demand";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let isRunning = false;

export interface PipelineResult {
  vodsTotal: number;
  omdbFound: number;
  catalogSaved: number;
  top10: Array<{ name: string; imdbID: string; imdbRating: number }>;
  onDemandSaved: number;
  ranAt: string;
}

export function isPipelineRunning() {
  return isRunning;
}

export async function runPipeline(): Promise<PipelineResult> {
  if (isRunning) throw new Error("El pipeline ya está en ejecución");
  isRunning = true;

  try {
    // ── 1. Fetch MwProxy VODs ────────────────────────────────────
    console.log("[Pipeline] Fetching MwProxy VODs...");
    const vods = await fetchAllVods();
    console.log(`[Pipeline] ${vods.length} VODs fetched`);

    // ── 2. Search each on OMDb → collect imdbIDs (1s between calls)
    console.log("[Pipeline] Phase 1: OMDb search...");
    const imdbMap = new Map<number, string>(); // vodId → imdbID

    // Normalizes a title for comparison: lowercase, dashes → space,
    // strip remaining punctuation, collapse whitespace.
    const normalizeTitle = (t: string) =>
      t.toLowerCase()
       .replace(/[-–—]/g, ' ')
       .replace(/[^\w\s]/g, '')
       .replace(/\s+/g, ' ')
       .trim();

    for (let i = 0; i < vods.length; i++) {
      const vod = vods[i];
      try {
        const { results } = await searchMovies(vod.name, { type: "movie" });
        const normalizedVodName = normalizeTitle(vod.name);
        const match = results.find((r) => {
          // Full normalized title (handles hyphen variants like Spider-Man → Spider Man)
          const full = normalizeTitle(r.title);
          // Also try stripping a space-surrounded dash subtitle, e.g. "Chapter 3 - Parabellum" → "Chapter 3"
          const noSubtitle = normalizeTitle(r.title.replace(/\s+[-–—]\s+.+$/, ''));
          const titleMatch = full === normalizedVodName ||
            (noSubtitle !== full && noSubtitle === normalizedVodName);
          const yearMatch = !vod.year || r.year === String(vod.year);
          return titleMatch && yearMatch;
        });
        if (match?.imdbID) imdbMap.set(vod.id, match.imdbID);
      } catch {
        /* skip */
      }
      if (i < vods.length - 1) await sleep(200);
    }

    console.log(`[Pipeline] ${imdbMap.size} IMDb IDs found`);

    // ── 3. Get OMDb details for each imdbID (1s between calls) ──
    console.log("[Pipeline] Phase 2: OMDb details...");

    interface EnrichedItem {
      vodId: number;
      name: string;
      year: number | null;
      available: boolean;
      imdbID: string;
      imdbRating: number;
      imdbVotes: number;
      poster: string | null;
    }

    const enriched: EnrichedItem[] = [];
    const entries = [...imdbMap.entries()];

    for (let i = 0; i < entries.length; i++) {
      const [vodId, imdbID] = entries[i];
      const vod = vods.find((v) => v.id === vodId)!;
      try {
        const details = await getMovieById(imdbID);
        const rating = details?.imdbRating as string | undefined;
        if (details && rating && rating !== "N/A") {
          enriched.push({
            vodId,
            name: vod.name,
            year: vod.year,
            available: vod.available,
            imdbID,
            imdbRating: parseFloat(rating),
            imdbVotes: parseInt(
              ((details.imdbVotes as string) ?? "0").replace(/,/g, ""),
              10,
            ),
            poster:
              (details.Poster as string) !== "N/A"
                ? (details.Poster as string)
                : null,
          });
        }
      } catch {
        /* skip */
      }
      if (i < entries.length - 1) await sleep(200);
    }

    // ── 4. Sort by votes descending ──────────────────────────────
    enriched.sort((a, b) => b.imdbVotes - a.imdbVotes);

    // ── 5. Save full catalog to mwproxy_catalog ──────────────────
    console.log(`[Pipeline] Saving ${vods.length} VODs to catalog...`);
    const enrichedMap = new Map(enriched.map(e => [e.vodId, e]));

    for (const vod of vods) {
      const e = enrichedMap.get(vod.id);
      if (e) {
        await prisma.mwproxyCatalog.upsert({
          where:  { mwproxy_id: vod.id },
          create: { mwproxy_id: vod.id, name: vod.name, year: vod.year,
                    available: vod.available, imdb_id: e.imdbID,
                    imdb_rating: e.imdbRating, imdb_votes: e.imdbVotes,
                    enriched_at: new Date() },
          update: { name: vod.name, year: vod.year, available: vod.available,
                    imdb_id: e.imdbID, imdb_rating: e.imdbRating,
                    imdb_votes: e.imdbVotes, enriched_at: new Date() },
        });
      } else {
        await prisma.mwproxyCatalog.upsert({
          where:  { mwproxy_id: vod.id },
          create: { mwproxy_id: vod.id, name: vod.name, year: vod.year,
                    available: vod.available },
          update: { name: vod.name, year: vod.year, available: vod.available },
        });
      }
    }

    // ── 6. Disable all on_demand entries before rebuilding top 10 ─
    console.log("[Pipeline] Disabling all on_demand entries...");
    await prisma.onDemand.updateMany({ data: { isActive: false } });

    // ── 7. Build top 10 with fanart-aware selection ──────────────
    // Walk the votes-sorted pool and pick the next available candidate
    // whose fanart lookup succeeds (skips movies fanart cannot find).
    const available = enriched.filter(m => m.available && m.imdbRating >= 6.0);
    const classicsPool = available.filter(m => m.year !== null && m.year <= 2010);
    const modernPool   = available.filter(m => m.year === null || m.year >= 2011);

    const tryPick = async (pool: EnrichedItem[], limit: number) => {
      const picked: Array<EnrichedItem & { background: string | null; logo: string | null }> = [];
      for (const item of pool) {
        if (picked.length >= limit) break;
        try {
          const fanart = await getFanartForMovie(item.imdbID);
          if (!fanart) {
            console.log(`[Pipeline] No fanart for ${item.name} (${item.imdbID}), skipping`);
            continue;
          }
          const background = pickMostLiked(fanart.backgrounds)?.url ?? null;
          const logo = pickMostLiked(fanart.logos)?.url ?? null;
          picked.push({ ...item, background, logo });
        } catch (err) {
          console.warn(`[Pipeline] fanart error for ${item.name} (${item.imdbID}): ${err instanceof Error ? err.message : err}`);
        }
      }
      return picked;
    };

    console.log("[Pipeline] Picking top 10 with fanart...");
    const classicsPicks = await tryPick(classicsPool, 2);
    const modernPicks   = await tryPick(modernPool, 8);
    const top10 = [...classicsPicks, ...modernPicks];
    console.log("[Pipeline] Top 10:", top10.map((m) => m.name));

    // ── 8 & 9. Save top 10 to on_demand ──────────────────────────
    console.log("[Pipeline] Saving on_demand entries...");
    let onDemandSaved = 0;

    for (const item of top10) {
      try {
        await upsertOnDemand({
          imdbID: item.imdbID,
          title: item.name,
          year: item.year?.toString() ?? "",
          poster: item.poster,
          background: item.background,
          logo: item.logo,
          imdb_rating: item.imdbRating,
          imdb_votes: item.imdbVotes,
        });
        await prisma.onDemand.update({
          where: { imdbID: item.imdbID },
          data: { isActive: true },
        });
        onDemandSaved++;
      } catch (err) {
        console.error(`[Pipeline] Save error for ${item.imdbID}:`, err);
      }
    }

    const result: PipelineResult = {
      vodsTotal: vods.length,
      omdbFound: enriched.length,
      catalogSaved: vods.length,
      top10: top10.map((m) => ({
        name: m.name,
        imdbID: m.imdbID,
        imdbRating: m.imdbRating,
      })),
      onDemandSaved,
      ranAt: new Date().toISOString(),
    };

    console.log("[Pipeline] Done:", result);
    return result;
  } finally {
    isRunning = false;
  }
}
