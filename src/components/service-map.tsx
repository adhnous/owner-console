'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { getClientLocale, tr } from '@/lib/i18n';
import { tileUrl, tileAttribution, markerHtml } from '@/lib/map';

// Dynamically import react-leaflet components on client only to avoid double-initialization
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false }) as any;
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false }) as any;
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false }) as any;
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false }) as any;
const ScaleControl = dynamic(() => import('react-leaflet').then((m) => m.ScaleControl), { ssr: false }) as any;

export type ServiceMapProps = {
  lat: number;
  lng: number;
  title?: string;
  area?: string;
  city?: string;
  zoom?: number;
};

export default function ServiceMap({ lat, lng, title, area, city, zoom = 14 }: ServiceMapProps) {
  const center = useMemo(() => [lat, lng] as [number, number], [lat, lng]);
  const gmapsUrl = useMemo(() => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, [lat, lng]);
  const appleMapsUrl = useMemo(() => `http://maps.apple.com/?q=${lat},${lng}`, [lat, lng]);
  const geoUrl = useMemo(() => `geo:${lat},${lng}?q=${lat},${lng}`, [lat, lng]);
  const [mounted, setMounted] = useState(false);
  // Unique key per mounted instance to avoid React Strict Mode double-mount container reuse
  const instanceKeyRef = useRef<string>(`map-${Math.random().toString(36).slice(2)}`);
  const provider = (process.env.NEXT_PUBLIC_MAP_PROVIDER || 'osm').toLowerCase();
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const prefersGoogle = provider === 'google' && !!googleKey;
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const gMapRef = useRef<any>(null);
  const gMarkerRef = useRef<any>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const locale = getClientLocale();

  // Leaflet extras for the free map
  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: '',
      html: markerHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load Google Maps script if key provided
  useEffect(() => {
    if (!mounted || !prefersGoogle) return;
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.google && w.google.maps) {
      setGoogleReady(true);
      return;
    }
    const existing = document.getElementById('google-maps-script') as HTMLScriptElement | null;
    if (existing) {
      if (w.google && w.google.maps) {
        setGoogleReady(true);
      } else {
        existing.addEventListener('load', () => setGoogleReady(true), { once: true } as any);
      }
      return;
    }
    const lang = getClientLocale();
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleKey}&language=${lang}&region=LY&libraries=places`;
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
  }, [mounted, prefersGoogle, googleKey, provider]);

  // Initialize or update Google Map
  useEffect(() => {
    if (!prefersGoogle || !googleReady || !mapDivRef.current) return;
    const w = window as any;
    const pos = { lat: Number(lat), lng: Number(lng) };
    if (!gMapRef.current) {
      gMapRef.current = new w.google.maps.Map(mapDivRef.current, {
        center: pos,
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });
      gMarkerRef.current = new w.google.maps.Marker({
        position: pos,
        map: gMapRef.current,
        title: title || 'Service Location',
      });
      if (title || city || area) {
        const info = new w.google.maps.InfoWindow({
          content: `<div class="text-sm"><div class="font-semibold">${title || 'Service Location'}</div><div class="text-muted-foreground">${[area, city].filter(Boolean).join(', ')}</div></div>`,
        });
        gMarkerRef.current.addListener('click', () => info.open({ anchor: gMarkerRef.current, map: gMapRef.current }));
      }
      // Open Google Maps when clicking anywhere on the embedded map
      gMapRef.current.addListener('click', () => {
        try { window.open(gmapsUrl, '_blank'); } catch {}
      });
    } else {
      gMapRef.current.setCenter(pos);
      gMapRef.current.setZoom(zoom);
      if (gMarkerRef.current) gMarkerRef.current.setPosition(pos);
    }
  }, [prefersGoogle, googleReady, lat, lng, zoom, title, area, city, gmapsUrl]);

  return (
    <div key={`${instanceKeyRef.current}-${prefersGoogle ? 'g' : 'l'}`} className="relative w-full h-72 rounded-lg overflow-hidden border">
      {mounted && prefersGoogle ? (
        <div ref={mapDivRef} className="h-full w-full" />
      ) : mounted && (
        <MapContainer
          key={instanceKeyRef.current}
          center={center}
          zoom={zoom}
          className="h-full w-full"
          scrollWheelZoom={false}
          onClick={() => {
            try { window.open(gmapsUrl, '_blank'); } catch {}
          }}
          whenReady={(e: any) => {
            // Ensure Leaflet computes pane positions after mount
            const map = e.target;
            setTimeout(() => map.invalidateSize(), 0);
            // Open Google Maps on any click on the Leaflet map
            map.on('click', () => {
              try { window.open(gmapsUrl, '_blank'); } catch {}
            });
          }}
        >
          <TileLayer attribution={tileAttribution} url={tileUrl} />
          <ScaleControl position="bottomleft" />
          <Marker position={center as any} icon={markerIcon as any} eventHandlers={{ click: () => { try { window.open(gmapsUrl, '_blank'); } catch {} } }}>
            <Popup>
              <div className="text-sm space-y-1">
                <div className="font-semibold">{title || 'Service Location'}</div>
                <div className="text-muted-foreground">{[area, city].filter(Boolean).join(', ')}</div>
                <div className="pt-1">
                  <a
                    className="underline"
                    href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {tr(locale, 'form.map.openInOSM')}
                  </a>
                </div>
                <div>
                  <a
                    className="underline"
                    href={gmapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                </div>
                <div>
                  <a
                    className="underline"
                    href={appleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Apple Maps
                  </a>
                </div>
                <div>
                  <a
                    className="underline"
                    href={geoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Maps app
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      )}
      {/* Quick open buttons */}
      <div className="pointer-events-auto absolute bottom-2 right-2 z-[1] flex gap-2">
        <a className="rounded bg-background/80 px-2 py-1 text-xs underline shadow" href={gmapsUrl} target="_blank" rel="noreferrer">Google Maps</a>
        <a className="rounded bg-background/80 px-2 py-1 text-xs underline shadow" href={appleMapsUrl} target="_blank" rel="noreferrer">Apple Maps</a>
        <a className="rounded bg-background/80 px-2 py-1 text-xs underline shadow" href={geoUrl} target="_blank" rel="noreferrer">Maps app</a>
      </div>
      {provider !== 'google' && process.env.NODE_ENV !== 'production' && (
        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground shadow">
          {tr(locale, 'map.usingOSMBadge')}
        </div>
      )}
    </div>
  );
}
