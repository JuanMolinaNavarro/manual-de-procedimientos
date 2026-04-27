const OMDB_BASE_URL = 'https://www.omdbapi.com/';

export interface OmdbResult {
  title: string;
  year: string;
  imdbID: string;
  type: string;
  poster: string | null;
}

function buildUrl(params: Record<string, string | number | undefined | null>): string {
  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set('apikey', process.env.OMDB_API_KEY ?? '');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url.toString();
}

export interface OmdbDetail {
  imdbID: string;
  imdbRating: string;
  imdbVotes: string;
  [key: string]: unknown;
}

export async function getMovieById(imdbID: string): Promise<OmdbDetail | null> {
  if (!/^tt\d{7,8}$/.test(imdbID)) throw new Error(`Invalid IMDb ID: ${imdbID}`);
  const url = buildUrl({ i: imdbID, plot: 'short' });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);
  const data = await res.json();
  if (data.Response !== 'True') {
    if (data.Error === 'Incorrect IMDb ID.') return null;
    throw new Error(`OMDb error: ${data.Error}`);
  }
  return data as OmdbDetail;
}

export interface SearchMoviesResult {
  results: OmdbResult[];
  totalResults: number;
  page: number;
}

export async function searchMovies(
  keyword: string,
  opts: { type?: 'movie' | 'series' | 'episode'; year?: number; page?: number } = {}
): Promise<SearchMoviesResult> {
  if (!keyword?.trim()) throw new Error('keyword is required');

  const page = opts.page ?? 1;
  const url = buildUrl({
    s: keyword.trim(),
    type: opts.type,
    y: opts.year,
    page,
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OMDb HTTP ${res.status}`);

  const data = await res.json();
  if (data.Response !== 'True') {
    if (data.Error === 'Movie not found!') return { results: [], totalResults: 0, page };
    throw new Error(`OMDb error: ${data.Error}`);
  }

  return {
    results: (data.Search as Array<{ Title: string; Year: string; imdbID: string; Type: string; Poster: string }>).map(r => ({
      title: r.Title,
      year: r.Year,
      imdbID: r.imdbID,
      type: r.Type,
      poster: r.Poster !== 'N/A' ? r.Poster : null,
    })),
    totalResults: parseInt(data.totalResults, 10),
    page,
  };
}
