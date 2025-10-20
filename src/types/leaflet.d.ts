// Narrow augmentation without wiping built-in types
import 'leaflet';

declare module 'leaflet' {
  // Example: allow setting icon URLs via options without TS whining
  interface DefaultIconOptions extends IconOptions {
    crossOrigin?: boolean | '';
  }
}
