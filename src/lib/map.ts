// Shared map config for Leaflet/Google map components
// Keep this file side-effect free; consume only in client components.

export const tileUrl = process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const tileAttribution =
  process.env.NEXT_PUBLIC_OSM_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Reusable HTML for a simple green circular marker rendered via Leaflet divIcon
export const markerHtml =
  '<div style="width:20px;height:20px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 0 2px rgba(0,0,0,0.15)"></div>';
