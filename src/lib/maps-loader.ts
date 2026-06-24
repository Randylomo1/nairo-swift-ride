// Async Google Maps loader (browser only)
let loadPromise: Promise<typeof google> | null = null;

declare global {
  interface Window {
    __ucInitMaps?: () => void;
    google: typeof google;
  }
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) {
      reject(new Error("Google Maps key not configured"));
      return;
    }
    window.__ucInitMaps = () => resolve(window.google);
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key,
      loading: "async",
      libraries: "places,geometry",
      callback: "__ucInitMaps",
      v: "weekly",
    });
    if (channel) params.set("channel", channel);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export const NAIROBI_CENTER = { lat: -1.2921, lng: 36.8219 };
