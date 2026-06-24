import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, NAIROBI_CENTER } from "@/lib/maps-loader";

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

type Mode = "pickup" | "dropoff";

export function DeliveryMap({
  pickup,
  dropoff,
  onPickupChange,
  onDropoffChange,
  riderPosition,
  readonly = false,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const dropoffMarker = useRef<google.maps.Marker | null>(null);
  const riderMarker = useRef<google.maps.Marker | null>(null);
  const routeRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [mode, setMode] = useState<Mode>("pickup");
  const [error, setError] = useState<string | null>(null);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        const map = new g.maps.Map(ref.current, {
          center: NAIROBI_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
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
        if (!readonly) {
          map.addListener("click", async (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            const address = await reverseGeocode(pos);
            const pin = { ...pos, address };
            // Use latest mode via ref hack
            setMode((current) => {
              if (current === "pickup") {
                onPickupChange(pin);
                return "dropoff";
              }
              onDropoffChange(pin);
              return "pickup";
            });
          });
        }
      })
      .catch((err) => setError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reverseGeocode(pos: { lat: number; lng: number }): Promise<string> {
    if (!geocoderRef.current) return `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    try {
      const res = await geocoderRef.current.geocode({ location: pos });
      return res.results[0]?.formatted_address ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    } catch {
      return `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    }
  }

  // Update pickup marker
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (pickupMarker.current) pickupMarker.current.setMap(null);
    if (pickup) {
      pickupMarker.current = new window.google.maps.Marker({
        position: pickup,
        map: mapRef.current,
        label: { text: "P", color: "white", fontWeight: "700" },
        icon: pinSymbol("#0f172a"),
      });
    }
  }, [pickup]);

  // Update dropoff marker
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (dropoffMarker.current) dropoffMarker.current.setMap(null);
    if (dropoff) {
      dropoffMarker.current = new window.google.maps.Marker({
        position: dropoff,
        map: mapRef.current,
        label: { text: "D", color: "white", fontWeight: "700" },
        icon: pinSymbol("#10b981"),
      });
    }
  }, [dropoff]);

  // Update rider marker
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
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
  }, [riderPosition]);

  // Route + fit bounds
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (pickup && dropoff) {
      const svc = new window.google.maps.DirectionsService();
      svc.route(
        {
          origin: pickup,
          destination: dropoff,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (res, status) => {
          if (status === "OK" && res && routeRenderer.current) {
            routeRenderer.current.setDirections(res);
          }
        }
      );
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(dropoff);
      if (riderPosition) bounds.extend(riderPosition);
      mapRef.current.fitBounds(bounds, 80);
    } else if (pickup) {
      mapRef.current.panTo(pickup);
    }
  }, [pickup, dropoff, riderPosition]);

  return (
    <div className={"relative " + (className ?? "")}>
      <div ref={ref} className="absolute inset-0 rounded-lg overflow-hidden" />
      {!readonly && (
        <div className="absolute top-3 left-3 right-3 flex gap-2 z-10">
          <ModeBtn active={mode === "pickup"} onClick={() => setMode("pickup")}>
            <span className="inline-block size-2 rounded-full bg-navy" /> Pin pickup
          </ModeBtn>
          <ModeBtn active={mode === "dropoff"} onClick={() => setMode("dropoff")}>
            <span className="inline-block size-2 rounded-full bg-emerald" /> Pin dropoff
          </ModeBtn>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-card text-sm text-destructive p-4 text-center">
          {error}
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

function pinSymbol(color: string): google.maps.Icon {
  // SVG pin
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='34' height='44' viewBox='0 0 34 44'><path d='M17 0C7.6 0 0 7.6 0 17c0 12 17 27 17 27s17-15 17-27C34 7.6 26.4 0 17 0z' fill='${color}'/></svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(34, 44),
    anchor: new window.google.maps.Point(17, 44),
    labelOrigin: new window.google.maps.Point(17, 15),
  };
}
