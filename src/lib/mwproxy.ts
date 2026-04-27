import https from 'https';
import { URL } from 'url';

const EXCLUDED_CATEGORY_IDS = new Set([11, 15]);
const PAGE_SIZE = 100;

export interface MwProxyVod {
  id: number;
  name: string;
  year: number | null;
  available: boolean;
  genres: Array<{ id: number; name: string }>;
  ratings: Array<{ id: number; name: string }>;
}

type RawVod = {
  id: number;
  name: string;
  year?: number;
  available?: boolean;
  simple_categories?: Array<{ id: number; name: string }>;
  genres?: Array<{ id: number; name: string }>;
  ratings?: Array<{ id: number; name: string }>;
};

function mwRequest(path: string): Promise<RawVod[] | null> {
  const token = process.env.MWPROXY_TOKEN ?? '';
  const baseUrl = process.env.MWPROXY_BASE_URL ?? 'https://gotvmwproxy.boldmss.com';
  const auth = Buffer.from(`${token}:`).toString('base64');
  const urlObj = new URL(path, baseUrl);

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      rejectUnauthorized: false, // self-signed cert
    };

    https
      .get(options, res => {
        if (res.statusCode === 204) return resolve(null);

        let data = '';
        res.on('data', (chunk: string) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Respuesta inválida de MwProxy')); }
        });
      })
      .on('error', reject);
  });
}

export async function fetchAllVods(): Promise<MwProxyVod[]> {
  const all: MwProxyVod[] = [];
  let page = 1;

  while (true) {
    const items = await mwRequest(`/api_rest/vods?page=${page}&page_size=${PAGE_SIZE}`);

    if (!items || items.length === 0) break;

    for (const vod of items) {
      const categoryIds = (vod.simple_categories ?? []).map(c => c.id);
      if (categoryIds.some(id => EXCLUDED_CATEGORY_IDS.has(id))) continue;

      all.push({
        id: vod.id,
        name: vod.name,
        year: vod.year ?? null,
        available: vod.available ?? false,
        genres: vod.genres ?? [],
        ratings: vod.ratings ?? [],
      });
    }

    if (items.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}
