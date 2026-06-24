export const FARE_CONFIG = {
  baseFee: 150,
  perKm: 25,
  perKg: 10,
  expressSurcharge: 200,
  sameDaySurcharge: 100,
  scheduledFee: 80,
  extraStop: 100,
  minFare: 200,
};

export type DeliveryType = "standard" | "express" | "same_day" | "scheduled";

export interface FareInput {
  distanceKm: number;
  weightKg: number;
  deliveryType: DeliveryType;
  extraStops?: number;
}

export interface FareBreakdown {
  base: number;
  distance: number;
  weight: number;
  typeSurcharge: number;
  stops: number;
  total: number;
  etaMinutes: number;
}

export function calculateFare(input: FareInput): FareBreakdown {
  const distance = Math.max(0, input.distanceKm) * FARE_CONFIG.perKm;
  const weight = Math.max(0, input.weightKg) * FARE_CONFIG.perKg;
  let surcharge = 0;
  if (input.deliveryType === "express") surcharge = FARE_CONFIG.expressSurcharge;
  else if (input.deliveryType === "same_day") surcharge = FARE_CONFIG.sameDaySurcharge;
  else if (input.deliveryType === "scheduled") surcharge = FARE_CONFIG.scheduledFee;
  const stops = (input.extraStops ?? 0) * FARE_CONFIG.extraStop;
  const subtotal = FARE_CONFIG.baseFee + distance + weight + surcharge + stops;
  const total = Math.max(FARE_CONFIG.minFare, Math.round(subtotal));
  // Avg 25 km/h in Nairobi traffic + 5 min handling
  const etaMinutes = Math.round((input.distanceKm / 25) * 60 + 5 + (input.extraStops ?? 0) * 4);
  return {
    base: FARE_CONFIG.baseFee,
    distance: Math.round(distance),
    weight: Math.round(weight),
    typeSurcharge: surcharge,
    stops,
    total,
    etaMinutes,
  };
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatKES(n: number) {
  return `Ksh ${Math.round(n).toLocaleString("en-KE")}`;
}
