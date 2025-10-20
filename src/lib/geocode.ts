export type ReverseResult = {
  displayName: string;
};

const cache = new Map<string, ReverseResult>();

function key(lat: number, lng: number, lang: string) {
  // Round to ~6 decimal places to avoid tiny cache misses
  return `${lat.toFixed(6)},${lng.toFixed(6)},${lang}`;
}

export function reverseGeocodeNominatim(
  lat: number,
  lng: number,
  lang: 'ar' | 'en' = 'en',
  signal?: AbortSignal
): Promise<ReverseResult> {
  const k = key(lat, lng, lang);
  const cached = cache.get(k);
  if (cached) return Promise.resolve(cached);

  // Prefer proxy (if defined), fallback to direct OSM
  const proxy = process.env.NEXT_PUBLIC_GEOCODE_PROXY || '/api/geocode/reverse';
  const tryProxy = async () => {
    try {
      const u = new URL(proxy, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      u.searchParams.set('lat', String(lat));
      u.searchParams.set('lng', String(lng));
      u.searchParams.set('lang', lang);
      const res = await fetch(u.toString(), { signal });
      if (res.ok) {
        const data = await res.json();
        const result: ReverseResult = { displayName: data.displayName || data.display_name || '' };
        cache.set(k, result);
        return result;
      }
      throw new Error('proxy failed');
    } catch (e) {
      // swallow and fallback
    }
    // direct nominatim
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    const res = await fetch(url.toString(), {
      headers: { 'Accept-Language': lang },
      signal,
    });
    if (!res.ok) throw new Error(`reverse failed: ${res.status}`);
    const data = await res.json();
    const result: ReverseResult = { displayName: data.display_name || '' };
    cache.set(k, result);
    return result;
  };

  return tryProxy();
}

export function getLangFromDocument(): 'ar' | 'en' {
  if (typeof document === 'undefined') return 'en';
  const l = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  return l.startsWith('ar') ? 'ar' : 'en';
}
