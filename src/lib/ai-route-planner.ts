import type { AiTravelStyle } from '@/lib/ai-itinerary-pricing';
import { getDestinationGeoRoute, type GeoRouteStop } from '@/lib/ai-geo-routes';
import { normalizeTravelStyle, pickThemeForStyle } from '@/lib/ai-travel-style';

export type PlannedDayRoute = {
  dayNumber: number;
  city: string;
  theme: string;
  overnightCity: string;
  transferNote?: string;
  isArrival: boolean;
  isDeparture: boolean;
};

export type ItineraryRoutePlan = {
  hub: string;
  destinationKey: string;
  style: AiTravelStyle;
  days: PlannedDayRoute[];
};

function overnightCityForStop(stop: GeoRouteStop): string {
  if (stop.dayTripFrom) return stop.dayTripFrom;
  return stop.city;
}

function assignChainIndices(middleDayCount: number, chainLength: number): number[] {
  if (middleDayCount <= 0 || chainLength <= 0) return [];
  if (chainLength === 1) return Array.from({ length: middleDayCount }, () => 0);

  const indices: number[] = [];
  let prev = 0;
  for (let i = 0; i < middleDayCount; i += 1) {
    const index = Math.min(
      chainLength - 1,
      Math.floor(((i + 1) * chainLength) / (middleDayCount + 1)),
    );
    const safe = Math.max(prev, index);
    indices.push(safe);
    prev = safe;
  }
  return indices;
}

function transferNote(prevStop: GeoRouteStop | null, stop: GeoRouteStop): string | undefined {
  if (stop.transferLabel) return stop.transferLabel;
  if (!prevStop || prevStop.city === stop.city) return undefined;
  if (stop.dayTripFrom) {
    return `Day excursion from ${stop.dayTripFrom} to ${stop.city}`;
  }
  return `Scenic transfer ${prevStop.city} → ${stop.city}`;
}

function effectiveChain(geo: ReturnType<typeof getDestinationGeoRoute>): GeoRouteStop[] {
  if (geo.chain.length <= 1) return geo.chain;
  const [first, ...rest] = geo.chain;
  if (first.city === geo.arrivalCity && rest.length > 0) return rest;
  return geo.chain;
}

export function buildItineraryRoutePlan(
  hub: string,
  destinationKey: string,
  numDays: number,
  styleInput: string,
): ItineraryRoutePlan {
  const style = normalizeTravelStyle(styleInput);
  const geo = getDestinationGeoRoute(destinationKey, hub);
  const chain = effectiveChain(geo);
  const days: PlannedDayRoute[] = [];

  for (let day = 1; day <= numDays; day += 1) {
    if (day === 1) {
      days.push({
        dayNumber: day,
        city: geo.arrivalCity,
        theme: 'Arrival & Orientation',
        overnightCity: geo.arrivalCity,
        isArrival: true,
        isDeparture: false,
      });
      continue;
    }

    if (day === numDays && numDays > 1) {
      days.push({
        dayNumber: day,
        city: geo.departureCity,
        theme: 'Farewell Moments',
        overnightCity: geo.departureCity,
        isArrival: false,
        isDeparture: true,
      });
      continue;
    }

    const middleDayCount = Math.max(0, numDays - 2);
    const middleIndex = day - 2;
    const chainIndices = assignChainIndices(middleDayCount, chain.length);
    const chainIndex = chainIndices[middleIndex] ?? 0;
    const stop = chain[chainIndex] ?? chain[0];
    const prevStop = middleIndex > 0 ? chain[chainIndices[middleIndex - 1] ?? 0] : null;

    days.push({
      dayNumber: day,
      city: stop.city,
      theme: pickThemeForStyle(stop.themes, style),
      overnightCity: overnightCityForStop(stop),
      transferNote: transferNote(prevStop, stop),
      isArrival: false,
      isDeparture: false,
    });
  }

  return { hub, destinationKey, style, days };
}

export function getPlannedDayRoute(
  plan: ItineraryRoutePlan,
  dayNumber: number,
): PlannedDayRoute | undefined {
  return plan.days.find((day) => day.dayNumber === dayNumber);
}
