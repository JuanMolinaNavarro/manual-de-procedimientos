import { prisma } from '@/lib/prisma';

export interface OnDemandData {
  imdbID: string;
  title: string;
  year: string;
  poster?: string | null;
  background?: string | null;
  logo?: string | null;
  imdb_rating?: number | null;
  imdb_votes?: number | null;
}

export function getAllOnDemand() {
  return prisma.onDemand.findMany({
    orderBy: [{ isActive: 'desc' }, { imdb_votes: 'desc' }, { created_at: 'desc' }],
  });
}

export function getActiveOnDemand() {
  return prisma.onDemand.findMany({
    where: { isActive: true },
    orderBy: [{ imdb_votes: 'desc' }, { created_at: 'desc' }],
    select: { imdbID: true, title: true, year: true, poster: true, background: true, logo: true },
  });
}

export function upsertOnDemand(data: OnDemandData) {
  return prisma.onDemand.upsert({
    where: { imdbID: data.imdbID },
    create: { ...data },
    update: {
      title: data.title,
      year: data.year,
      poster: data.poster,
      background: data.background,
      logo: data.logo,
      imdb_rating: data.imdb_rating,
      imdb_votes: data.imdb_votes,
    },
  });
}

export function setOnDemandActive(id: number, isActive: boolean) {
  return prisma.onDemand.update({ where: { id }, data: { isActive } });
}
