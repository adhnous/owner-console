'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { getClientLocale } from '@/lib/i18n';

export type AddressSearchProps = {
  placeholder?: string;
  defaultQuery?: string;
  countryCodes?: string; // e.g., 'ly'
  onSelect: (res: { lat: number; lng: number; displayName: string }) => void;
  className?: string;
  city?: string; // scope search to a given city; when provided, show city places even if query is empty
};

export default function AddressSearch({
  placeholder = 'Search address',
  defaultQuery = '',
  countryCodes = 'ly',
  onSelect,
  className = '',
  city,
}: AddressSearchProps) {
  const [q, setQ] = useState(defaultQuery);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const t = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const lang = getClientLocale();

  useEffect(() => {
    if (t.current) window.clearTimeout(t.current);
    const hasQuery = !!q && q.trim().length >= 2;
    const hasCity = !!city && city.trim().length > 0;
    if (!hasQuery && !hasCity) {
      setResults([]);
      setOpen(false);
      return;
    }
    t.current = window.setTimeout(async () => {
      try {
        setLoading(true);
        const url = new URL('/api/geocode/search', window.location.origin);
        if (hasQuery) url.searchParams.set('q', q);
        if (hasCity) url.searchParams.set('city', city!);
        url.searchParams.set('limit', hasQuery ? '5' : '10');
        if (countryCodes) url.searchParams.set('countrycodes', countryCodes);
        url.searchParams.set('lang', lang);
        const res = await fetch(url.toString());
        const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch (e) {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (t.current) window.clearTimeout(t.current);
    };
  }, [q, city, lang, countryCodes]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!listRef.current) return;
      if (!listRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <div className={`relative ${className}`} ref={listRef}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          // If we already have city-scoped results, show them on focus
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="h-10"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-background shadow">
          {results.map((r, idx) => (
            <button
              key={`${r.lat}-${r.lon}-${idx}`}
              type="button"
              className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                const lat = Number(r.lat);
                const lng = Number(r.lon);
                setQ(r.display_name);
                setOpen(false);
                onSelect({ lat, lng, displayName: r.display_name });
              }}
            >
              {r.display_name}
            </button>
          ))}
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
          )}
        </div>
      )}
    </div>
  );
}
