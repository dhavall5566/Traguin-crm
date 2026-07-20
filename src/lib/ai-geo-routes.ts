/** Geographic stop chains — days progress forward through the list (no backtracking). */

export type GeoRouteStop = {
  city: string;
  themes: string[];
  /** Stay overnight here; false = day excursion from `dayTripFrom`. */
  overnight?: boolean;
  dayTripFrom?: string;
  transferLabel?: string;
};

export type DestinationGeoRoute = {
  arrivalCity: string;
  departureCity: string;
  /** Ordered logical drive sequence for the region. */
  chain: GeoRouteStop[];
};

export const DESTINATION_GEO_ROUTES: Record<string, DestinationGeoRoute> = {
  australia: {
    arrivalCity: 'Sydney',
    departureCity: 'Sydney',
    chain: [
      { city: 'Sydney', themes: ['City Highlights'], overnight: true },
      {
        city: 'Blue Mountains',
        themes: ['Nature & Viewpoints'],
        dayTripFrom: 'Sydney',
        transferLabel: 'Scenic drive west to Blue Mountains',
      },
      {
        city: 'Bondi',
        themes: ['Adventure Track'],
        dayTripFrom: 'Sydney',
        transferLabel: 'Coastal transfer to Bondi & eastern beaches',
      },
    ],
  },
  bali: {
    arrivalCity: 'Seminyak',
    departureCity: 'Ubud',
    chain: [
      { city: 'Seminyak', themes: ['Neighborhood Gems'], overnight: true },
      {
        city: 'Ubud',
        themes: ['City Highlights', 'Culture & Museums'],
        overnight: true,
        transferLabel: 'Transfer to Ubud cultural heartland',
      },
      {
        city: 'Tegallalang',
        themes: ['Nature & Viewpoints'],
        dayTripFrom: 'Ubud',
        transferLabel: 'Short drive to Tegallalang rice terraces',
      },
      {
        city: 'Canggu',
        themes: ['Neighborhood Gems'],
        overnight: true,
        transferLabel: 'Southbound coastal drive to Canggu',
      },
      {
        city: 'Ayung River',
        themes: ['Adventure Track', 'Wellness Day'],
        dayTripFrom: 'Ubud',
        transferLabel: 'River valley excursion from Ubud',
      },
    ],
  },
  kerala: {
    arrivalCity: 'Fort Kochi',
    departureCity: 'Kochi',
    chain: [
      { city: 'Fort Kochi', themes: ['City Highlights'], overnight: true },
      {
        city: 'Munnar',
        themes: ['City Highlights'],
        overnight: true,
        transferLabel: 'Hill-road transfer Fort Kochi → Munnar tea country',
      },
      {
        city: 'Alleppey',
        themes: ['Nature & Viewpoints'],
        overnight: true,
        transferLabel: 'Descent transfer Munnar → Alleppey backwaters',
      },
      {
        city: 'Marari Beach',
        themes: ['Wellness Day'],
        overnight: true,
        transferLabel: 'Short coastal hop Alleppey → Marari Beach',
      },
    ],
  },
  rajasthan: {
    arrivalCity: 'Jaipur',
    departureCity: 'Udaipur',
    chain: [
      { city: 'Jaipur', themes: ['City Highlights', 'Culture & Museums'], overnight: true },
      {
        city: 'Pushkar',
        themes: ['Culture & Museums'],
        overnight: true,
        transferLabel: 'Overland transfer Jaipur → Pushkar lake town',
      },
      {
        city: 'Udaipur',
        themes: ['Culture & Museums', 'City Highlights'],
        overnight: true,
        transferLabel: 'Scenic drive Pushkar → Udaipur lake city',
      },
    ],
  },
  manali: {
    arrivalCity: 'Manali',
    departureCity: 'Naggar',
    chain: [
      { city: 'Manali', themes: ['City Highlights'], overnight: true },
      {
        city: 'Solang Valley',
        themes: ['Nature & Viewpoints', 'Adventure Track'],
        dayTripFrom: 'Manali',
        transferLabel: 'Mountain road to Solang Valley',
      },
      {
        city: 'Naggar',
        themes: ['Culture & Museums'],
        overnight: true,
        transferLabel: 'Valley drive Manali → Naggar heritage village',
      },
    ],
  },
  goa: {
    arrivalCity: 'Candolim',
    departureCity: 'Panjim',
    chain: [
      { city: 'Old Goa', themes: ['City Highlights'], overnight: true },
      {
        city: 'Panjim',
        themes: ['City Highlights', 'Neighborhood Gems'],
        overnight: true,
        transferLabel: 'Coastal drive north Goa → Panjim',
      },
      {
        city: 'Mollem',
        themes: ['Nature & Viewpoints'],
        dayTripFrom: 'Panjim',
        transferLabel: 'Inland transfer to Mollem & Dudhsagar region',
      },
    ],
  },
  gujarat: {
    arrivalCity: 'Ahmedabad',
    departureCity: 'Ahmedabad',
    chain: [
      { city: 'Ahmedabad', themes: ['Heritage', 'City Highlights'], overnight: true },
      {
        city: 'Patan',
        themes: ['Heritage', 'Culture & Museums'],
        overnight: true,
        transferLabel: 'Northbound drive Ahmedabad → Patan stepwell circuit',
      },
      {
        city: 'Kutch',
        themes: ['Culture & Museums', 'Nature & Viewpoints'],
        overnight: true,
        transferLabel: 'Long scenic transfer Patan → Rann of Kutch',
      },
    ],
  },
  dubai: {
    arrivalCity: 'Dubai Marina',
    departureCity: 'Dubai',
    chain: [
      { city: 'Dubai Marina', themes: ['City Highlights'], overnight: true },
      {
        city: 'Downtown Dubai',
        themes: ['City Highlights'],
        overnight: true,
        transferLabel: 'City transfer Marina → Downtown Dubai',
      },
      {
        city: 'Dubai Desert',
        themes: ['Nature & Viewpoints', 'Adventure Track'],
        dayTripFrom: 'Dubai',
        transferLabel: 'Desert safari transfer from Dubai city',
      },
    ],
  },
  thailand: {
    arrivalCity: 'Bangkok',
    departureCity: 'Bangkok',
    chain: [
      { city: 'Bangkok', themes: ['City Highlights'], overnight: true },
      {
        city: 'Ayutthaya',
        themes: ['Culture & Museums'],
        dayTripFrom: 'Bangkok',
        transferLabel: 'Day trip north to Ayutthaya UNESCO ruins',
      },
      {
        city: 'Phi Phi Islands',
        themes: ['Nature & Viewpoints', 'Adventure Track'],
        overnight: true,
        transferLabel: 'Flight/ferry connection Bangkok → Andaman coast',
      },
    ],
  },
  kashmir: {
    arrivalCity: 'Srinagar',
    departureCity: 'Srinagar',
    chain: [
      { city: 'Srinagar', themes: ['City Highlights'], overnight: true },
      {
        city: 'Gulmarg',
        themes: ['Nature & Viewpoints', 'Adventure Track'],
        overnight: true,
        transferLabel: 'Mountain transfer Srinagar → Gulmarg meadows',
      },
      {
        city: 'Pahalgam',
        themes: ['Nature & Viewpoints'],
        overnight: true,
        transferLabel: 'Valley drive Gulmarg region → Pahalgam',
      },
    ],
  },
  ladakh: {
    arrivalCity: 'Leh',
    departureCity: 'Leh',
    chain: [
      { city: 'Leh', themes: ['City Highlights'], overnight: true },
      {
        city: 'Nubra Valley',
        themes: ['Nature & Viewpoints', 'Adventure Track'],
        overnight: true,
        transferLabel: 'Khardung La crossing Leh → Nubra Valley',
      },
      {
        city: 'Pangong Lake',
        themes: ['Nature & Viewpoints'],
        dayTripFrom: 'Leh',
        transferLabel: 'High-altitude drive to Pangong Lake',
      },
    ],
  },
  kenya: {
    arrivalCity: 'Nairobi',
    departureCity: 'Nairobi',
    chain: [
      { city: 'Nairobi', themes: ['City Highlights'], overnight: true },
      {
        city: 'Lake Nakuru',
        themes: ['Nature & Viewpoints'],
        overnight: true,
        transferLabel: 'Safari drive Nairobi → Lake Nakuru',
      },
      {
        city: 'Maasai Mara',
        themes: ['Nature & Viewpoints', 'Adventure Track'],
        overnight: true,
        transferLabel: 'Game-route transfer Lake Nakuru → Maasai Mara',
      },
    ],
  },
};

export function getDestinationGeoRoute(destinationKey: string, hub: string): DestinationGeoRoute {
  const configured = DESTINATION_GEO_ROUTES[destinationKey];
  if (configured) return configured;

  const parts = hub
    .split(/&|,/)
    .map((part) => part.trim())
    .filter(Boolean);
  const fallbackCity = parts[0] ?? hub.trim() || 'Destination';
  const chain: GeoRouteStop[] =
    parts.length > 1
      ? parts.map((city, index) => ({
          city,
          themes: ['City Highlights', 'Nature & Viewpoints'],
          overnight: index < parts.length - 1,
          transferLabel:
            index > 0 ? `Overland transfer ${parts[index - 1]} → ${city}` : undefined,
        }))
      : [{ city: fallbackCity, themes: ['City Highlights', 'Nature & Viewpoints'], overnight: true }];

  return {
    arrivalCity: fallbackCity,
    departureCity: parts[parts.length - 1] ?? fallbackCity,
    chain,
  };
}
