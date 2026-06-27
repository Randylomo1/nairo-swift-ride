/// <reference types="google.maps" />
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
    
    // Handle both successful load and Google Maps errors
    window.__ucInitMaps = () => {
      // Check if maps initialized properly
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps failed to initialize"));
      }
    };
    
    // Add a global error listener for Google Maps API errors
    const originalOnError = window.onerror;
    window.onerror = (msg, url, line, col, error) => {
      if (typeof msg === 'string' && msg.includes('Google Maps JavaScript API error')) {
        reject(new Error(msg));
        return true;
      }
      if (originalOnError) {
        return originalOnError(msg, url, line, col, error);
      }
      return false;
    };
    
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
    script.onerror = () => {
      window.onerror = originalOnError;
      reject(new Error("Failed to load Google Maps"));
    };
    
    // Restore original onerror after a timeout
    setTimeout(() => {
      window.onerror = originalOnError;
    }, 30000);
    
    document.head.appendChild(script);
  });
  return loadPromise;
}

export const NAIROBI_CENTER = { lat: -1.2921, lng: 36.8219 };
