const FANART_BASE_URL = 'https://webservice.fanart.tv/v3.2/';

export interface FanartImage {
  id: string;
  url: string;
  lang: string;
  likes: number;
}

export interface FanartMovieImages {
  backgrounds: FanartImage[];
  logos: FanartImage[];
}

type RawImage = { id: string; url: string; lang: string; likes: string };

function mapImages(arr: RawImage[] | undefined): FanartImage[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(img => ({
    id: img.id,
    url: img.url,
    lang: img.lang,
    likes: parseInt(img.likes, 10),
  }));
}

/** Spanish-first, English-fallback, most-liked. Returns null if neither found.
 *  Use this for logos and text-bearing artwork where language matters. */
export function pickBestImage(images: FanartImage[]): FanartImage | null {
  if (!images.length) return null;
  const byLikes = (a: FanartImage, b: FanartImage) => b.likes - a.likes;
  const spanish = images.filter(img => img.lang === 'es').sort(byLikes);
  if (spanish.length) return spanish[0];
  const english = images.filter(img => img.lang === 'en').sort(byLikes);
  if (english.length) return english[0];
  return null;
}

/** Most-liked image regardless of language.
 *  Use this for backgrounds, which are language-neutral scenes (lang "00"). */
export function pickMostLiked(images: FanartImage[]): FanartImage | null {
  if (!images.length) return null;
  return [...images].sort((a, b) => b.likes - a.likes)[0];
}

export async function getFanartForMovie(imdbID: string): Promise<FanartMovieImages | null> {
  const url = `${FANART_BASE_URL}movies/${imdbID}?api_key=${process.env.FANART_API_KEY ?? ''}`;
  const res = await fetch(url);

  if (res.status === 404) return null;
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
    throw Object.assign(new Error('fanart.tv rate limited'), { retryAfter });
  }
  if (!res.ok) throw new Error(`fanart.tv HTTP ${res.status}`);

  const raw = await res.json();

  // Merge HD + standard logos, deduplicated by id
  const logoSources = [...mapImages(raw.hdmovielogo), ...mapImages(raw.movielogo)];
  const seenIds = new Set<string>();
  const logos = logoSources.filter(img => {
    if (seenIds.has(img.id)) return false;
    seenIds.add(img.id);
    return true;
  });

  return {
    backgrounds: mapImages(raw.moviebackground),
    logos,
  };
}
