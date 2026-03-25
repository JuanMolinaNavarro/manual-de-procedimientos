export const RETENCION_CASO_STORAGE_KEY = 'retencion.caso';

export type RetencionCasoSessionData = Record<string, string>;

export function readRetencionCasoSessionData(): RetencionCasoSessionData {
  if (typeof window === 'undefined') {
    return {};
  }

  const stored = window.sessionStorage.getItem(RETENCION_CASO_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<RetencionCasoSessionData>((acc, [key, value]) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function mergeRetencionCasoSessionData(
  nextData: RetencionCasoSessionData,
): RetencionCasoSessionData {
  if (typeof window === 'undefined') {
    return nextData;
  }

  const sanitizedNextData = Object.entries(nextData).reduce<RetencionCasoSessionData>(
    (acc, [key, value]) => {
      const normalized = value.trim();
      if (normalized.length > 0) {
        acc[key] = normalized;
      }
      return acc;
    },
    {},
  );

  const mergedData = {
    ...readRetencionCasoSessionData(),
    ...sanitizedNextData,
  };

  window.sessionStorage.setItem(RETENCION_CASO_STORAGE_KEY, JSON.stringify(mergedData));
  return mergedData;
}
