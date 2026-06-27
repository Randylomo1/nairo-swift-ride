import { useEffect, useRef, useState, useCallback } from "react";
import { loadGoogleMaps, NAIROBI_CENTER } from "@/lib/maps-loader";
import { Crosshair, LocateFixed, MapPin, Check } from "lucide-react";

export interface LocationPin {
  lat: number;
  lng: number;
  address: string;
}

interface Props {
  pickup: LocationPin | null;
  dropoff: LocationPin | null;
  onPickupChange: (p: LocationPin) => void;
  onDropoffChange: (p: LocationPin) => void;
  riderPosition?: { lat: number; lng: number } | null;
  readonly?: boolean;
  className?: string;
}

type Mode = "pickup" | "dropoff" | null;

export function DeliveryMap({
  pickup,
  dropoff,
  onPickupChange,
  onDropoffChange,
  riderPosition,
  readonly = false,
  className,
}: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const dropoffMarker = useRef<google.maps.Marker | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const routeRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const idleListener = useRef<google.maps.MapsEventListener | null>(null);

  const [mode, setMode] = useState<Mode>(readonly ? null : "pickup");
  const [centerAddress, setCenterAddress] = useState<string>("");
  const [centerPos, setCenterPos] = useState<{ lat: number; lng: number }>(NAIROBI_CENTER);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);

  const reverseGeocode = useCallback(async (pos: { lat: number; lng: number }): Promise<string> => {
    if (!geocoderRef.current) return `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    try {
      const res = await geocoderRef.current.geocode({ location: pos });
      return res.results[0]?.formatted_address ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    } catch {
      return `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    }
  }, []);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new g.maps.Map(mapDivRef.current, {
          center: NAIROBI_CENTER,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        mapRef.current = map;
        geocoderRef.current = new g.maps.Geocoder();
        routeRenderer.current = new g.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#10b981", strokeWeight: 5, strokeOpacity: 0.9 },
        });
        setReady(true);
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
      if (idleListener.current) idleListener.current.remove();
    };
  }, []);

  // Re-attach idle listener for live reverse-geocode while picking
  useEffect(() => {
    if (!ready || !mapRef.current || readonly || !mode) {
      if (idleListener.current) {
        idleListener.current.remove();
        idleListener.current = null;
      }
      return;
    }
    if (idleListener.current) idleListener.current.remove();
    let cancelToken = 0;
    idleListener.current = mapRef.current.addListener("idle", async () => {
      const c = mapRef.current!.getCenter();
      if (!c) return;
      const pos = { lat: c.lat(), lng: c.lng() };
      setCenterPos(pos);
      const my = ++cancelToken;
      setResolving(true);
      const addr = await reverseGeocode(pos);
      if (my === cancelToken) {
        setCenterAddress(addr);
        setResolving(false);
      }
    });
    // Fire once for current center
    const c = mapRef.current.getCenter();
    if (c) {
      const pos = { lat: c.lat(), lng: c.lng() };
      setCenterPos(pos);
      setResolving(true);
      reverseGeocode(pos).then((addr) => {
        setCenterAddress(addr);
        setResolving(false);
      });
    }
    return () => {
      if (idleListener.current) {
        idleListener.current.remove();
        idleListener.current = null;
      }
    };
  }, [ready, mode, readonly, reverseGeocode]);

  // Pickup marker
  useEffect(() => {
    if (!ready || !window.google?.maps || !mapRef.current) return;
    if (pickupMarker.current) pickupMarker.current.setMap(null);
    if (pickup) {
      pickupMarker.current = new window.google.maps.Marker({
        position: pickup,
        map: mapRef.current,
        label: { text: "P", color: "white", fontWeight: "700" },
        icon: pinSymbol("#0f172a"),
      });
    }
  }, [pickup, ready]);

  // Dropoff marker
  useEffect(() => {
    if (!ready || !window.google?.maps || !mapRef.current) return;
    if (dropoffMarker.current) dropoffMarker.current.setMap(null);
    if (dropoff) {
      dropoffMarker.current = new window.google.maps.Marker({
        position: dropoff,
        map: mapRef.current,
        label: { text: "D", color: "white", fontWeight: "700" },
        icon: pinSymbol("#10b981"),
      });
    }
  }, [dropoff, ready]);

  // Rider marker
  useEffect(() => {
    if (!ready || !window.google?.maps || !mapRef.current) return;
    if (riderMarker.current) riderMarker.current.setMap(null);
    if (riderPosition) {
      riderMarker.current = new window.google.maps.Marker({
        position: riderPosition,
        map: mapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#f59e0b",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 3,
        },
      });
    }
  }, [riderPosition, ready]);

  // Route + bounds — only when not actively picking (so map can be moved freely)
  useEffect(() => {
    if (!ready || !window.google?.maps || !mapRef.current) return;
    if (pickup && dropoff) {
      const svc = new window.google.maps.DirectionsService();
      svc.route(
        {
          origin: pickup,
          destination: dropoff,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (res, status) => {
          if (status === "OK" && res && routeRenderer.current) routeRenderer.current.setDirections(res);
        }
      );
      if (!mode) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(pickup);
        bounds.extend(dropoff);
        if (riderPosition) bounds.extend(riderPosition);
        mapRef.current.fitBounds(bounds, 80);
      }
    }
  }, [pickup, dropoff, riderPosition, ready, mode]);

  // Pre-seed center from current pin when entering pick mode
  useEffect(() => {
    if (!ready || !mapRef.current || !mode) return;
    const target = mode === "pickup" ? pickup : dropoff;
    if (target) {
      mapRef.current.panTo(target);
      mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 13, 15));
    }
  }, [mode, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  function confirm() {
    if (!mode) return;
    const pin: LocationPin = { ...centerPos, address: centerAddress || `${centerPos.lat.toFixed(5)}, ${centerPos.lng.toFixed(5)}` };
    if (mode === "pickup") {
      onPickupChange(pin);
      setMode(dropoff ? null : "dropoff");
    } else {
      onDropoffChange(pin);
      setMode(null);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Geolocation not supported on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (mapRef.current) {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
          mapRef.current.panTo(pos);
          mapRef.current.setZoom(16);
        }
      },
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED ? "Location permission denied" : "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function searchAddress(query: string) {
    if (!query.trim() || !geocoderRef.current || !mapRef.current) return;
    try {
      const res = await geocoderRef.current.geocode({
        address: query,
        componentRestrictions: { country: "KE" },
      });
      const first = res.results[0];
      if (first?.geometry?.location) {
        const pos = { lat: first.geometry.location.lat(), lng: first.geometry.location.lng() };
        mapRef.current.panTo(pos);
        mapRef.current.setZoom(16);
      } else {
        setError("No matches for that address");
      }
    } catch {
      setError("Search failed");
    }
  }

  return (
    <div className={"relative " + (className ?? "")}>
      <div ref={mapDivRef} className="absolute inset-0 rounded-lg overflow-hidden bg-muted" />

      {/* Top controls */}
      {!readonly && (
        <div className="absolute top-3 left-3 right-3 z-10 space-y-2">
          <div className="flex gap-2">
            <ModeBtn active={mode === "pickup"} onClick={() => setMode("pickup")}>
              <span className="inline-block size-2 rounded-full bg-navy" />
              {pickup ? "Edit pickup" : "Set pickup"}
            </ModeBtn>
            <ModeBtn active={mode === "dropoff"} onClick={() => setMode("dropoff")}>
              <span className="inline-block size-2 rounded-full bg-emerald" />
              {dropoff ? "Edit dropoff" : "Set dropoff"}
            </ModeBtn>
          </div>
          {mode && (
            <div className="flex gap-2">
              <SearchBox onSearch={searchAddress} placeholder={`Search ${mode === "pickup" ? "pickup" : "dropoff"} in Nairobi…`} />
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-card text-foreground px-3 py-2 text-xs font-semibold shadow-card hover:bg-muted disabled:opacity-60"
                title="Use my current location"
              >
                <LocateFixed className="size-3.5" /> {locating ? "Locating…" : "My location"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Center crosshair (only while picking) */}
      {!readonly && mode && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="relative -translate-y-3">
            <MapPin
              className={"size-10 drop-shadow-lg " + (mode === "pickup" ? "text-navy" : "text-emerald")}
              strokeWidth={2.5}
              fill="white"
            />
            <Crosshair className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-3 text-foreground" />
          </div>
        </div>
      )}

      {/* Bottom confirm bar */}
      {!readonly && mode && (
        <div className="absolute bottom-3 left-3 right-3 z-10 card-surface p-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {mode === "pickup" ? "Pickup address" : "Dropoff address"}
            </div>
            <div className="text-sm font-medium truncate">
              {resolving ? "Resolving address…" : centerAddress || "Move the map to a location"}
            </div>
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={resolving || !centerAddress}
            className={
              "shrink-0 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold shadow-card transition disabled:opacity-50 " +
              (mode === "pickup" ? "bg-navy text-navy-foreground" : "bg-emerald text-emerald-foreground")
            }
          >
            <Check className="size-4" /> Confirm
          </button>
        </div>
      )}

      {error && (
        <div className="absolute bottom-3 left-3 right-3 z-20 rounded-md bg-destructive text-destructive-foreground text-xs px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}
    </div>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold shadow-card transition " +
        (active ? "bg-navy text-navy-foreground" : "bg-card text-foreground hover:bg-muted")
      }
    >
      {children}
    </button>
  );
}

function SearchBox({ onSearch, placeholder }: { onSearch: (q: string) => void; placeholder: string }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value);
      }}
      className="flex-1"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 rounded-md bg-card text-foreground border border-border px-3 text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </form>
  );
}

function pinSymbol(color: string): google.maps.Icon {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='34' height='44' viewBox='0 0 34 44'><path d='M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z' fill='${color}'/></svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(34, 44),
    anchor: new window.google.maps.Point(17, 44),
    labelOrigin: new window.google.maps.Point(17, 15),
  };
}
