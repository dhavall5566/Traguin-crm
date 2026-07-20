/** Famous places and structured copy for AI itinerary drafts. */

import {
  PlaceUsageTracker,
  splitPlacesList,
} from '@/lib/itinerary-place-dedup';

export type StructuredSegment = {
  category: string;
  places: string;
};

export type DaySightBundle = {
  sightseeing: StructuredSegment;
  optional: StructuredSegment;
  overnight: StructuredSegment;
  meals: StructuredSegment;
};

type DestinationProfile = {
  baseArea: string;
  arrival: {
    transfer: string;
    tour: string;
    dinner: string;
  };
  departure: {
    highlights: string;
    lunch: string;
    transfer: string;
  };
  themes: Record<string, DaySightBundle>;
};

const CATEGORY = {
  sightseeing: 'SIGHTSEEING INCLUDED',
  optional: 'EVENING EXPERIENCE',
  overnight: 'OVERNIGHT STAY',
  meals: 'MEALS INCLUDED',
} as const;

function bundle(
  sightseeing: string,
  optional: string,
  overnight: string,
  meals: string,
): DaySightBundle {
  return {
    sightseeing: { category: CATEGORY.sightseeing, places: sightseeing },
    optional: { category: CATEGORY.optional, places: optional },
    overnight: { category: CATEGORY.overnight, places: overnight },
    meals: { category: CATEGORY.meals, places: meals },
  };
}

const PROFILES: Record<string, DestinationProfile> = {
  bali: {
    baseArea: 'Ubud & Seminyak',
    arrival: {
      transfer: 'Ngurah Rai International Airport to Seminyak beach hotel',
      tour: 'Tanah Lot sea temple, Seminyak sunset beach walk, Petitenget coastal temple',
      dinner: 'Jimbaran Bay seafood dinner on the sand',
    },
    departure: {
      highlights: 'Ubud art market, Campuhan Ridge Walk, Tegenungan waterfall',
      lunch: 'Bebek Bengil (dirty duck) lunch in Ubud',
      transfer: 'Hotel to Ngurah Rai airport with express lane assist',
    },
    themes: {
      'City Highlights': bundle(
        'Ubud Monkey Forest, Ubud Royal Palace, Saraswati Temple lotus pond, Ubud Art Market',
        'Uluwatu Kecak fire dance, Nusa Penida day trip, Bali swing photo spots',
        'Ubud boutique villa with rice-field views',
        'Indonesian breakfast and chef’s tasting dinner at locavore-style restaurant',
      ),
      'Nature & Viewpoints': bundle(
        'Tegallalang Rice Terraces, Tirta Empul holy spring temple, Goa Gajah elephant cave, Mount Batur viewpoint',
        'Sunrise Mount Batur trek, Sekumpul waterfall hike, Bali bird park visit',
        'Ubud hillside resort overlooking Ayung River valley',
        'Farm-to-table lunch and traditional rijsttafel dinner',
      ),
      'Culture & Museums': bundle(
        'Besakih Mother Temple, Taman Ayun royal temple, Batuan village painting galleries, Celuk silver workshops',
        'Balinese cooking class, Barong dance performance, traditional gamelan workshop',
        'Sanur heritage beachfront hotel',
        'Balinese breakfast and royal court-inspired dinner',
      ),
      'Neighborhood Gems': bundle(
        'Canggu Echo Beach, Berawa surf strip, Pererenan rice lanes, Tanah Lot clifftop temple',
        'Surf lesson at Canggu, Finns Beach Club day pass, pottery class in Seseh',
        'Canggu designer villa near Batu Bolong',
        'Acai bowl brunch and Mediterranean sunset dinner',
      ),
      'Adventure Track': bundle(
        'Ayung River white-water rafting, Bali ATV rice-terrace trail, Hidden Canyon Beji Guwang',
        'Mount Batur sunrise jeep tour, cliff jumping at Aling-Aling waterfall, canyon tubing',
        'Adventure base camp lodge near Ayung River',
        'Energy breakfast and barbecue dinner after activities',
      ),
      'Wellness Day': bundle(
        'Tirta Empul purification ritual, Yoga Barn wellness campus, Tjampuhan spa valley walk',
        'Floating breakfast, sound-healing session, couples spa ritual at jungle retreat',
        'Wellness retreat villa with private plunge pool',
        'Detox brunch and plant-based tasting menu dinner',
      ),
    },
  },
  manali: {
    baseArea: 'Manali',
    arrival: {
      transfer: 'Kullu–Manali airport or Volvo drop to Old Manali hotel',
      tour: 'Hadimba Devi Temple, Old Manali café lane, Mall Road evening stroll',
      dinner: 'Himachali siddu & trout dinner at riverside dhaba',
    },
    departure: {
      highlights: 'Vashisht hot springs, Manu Temple, Naggar Castle art gallery',
      lunch: 'Naggar trout house lunch with Kullu valley views',
      transfer: 'Manali hotel to Chandigarh or airport transfer',
    },
    themes: {
      'Nature & Viewpoints': bundle(
        'Solang Valley meadow, snow-point viewpoints, adventure activity arenas, Rohtang Pass snow line (seasonal)',
        'Tandem paragliding, quad biking over snow, or Atal Tunnel north-portal crossing',
        'Manali premium customised riverside resort',
        'Premium breakfast and chef’s special dinner',
      ),
      'City Highlights': bundle(
        'Mall Road, Tibetan Monastery, Van Vihar nature park, Manu Temple heritage walk',
        'Old Manali live music cafés, river rafting on Beas, Manali wildlife sanctuary',
        'Mall Road heritage boutique hotel',
        'Himachali thali lunch and riverside dinner',
      ),
      'Adventure Track': bundle(
        'Solang Valley zipline circuit, Hampta Pass viewpoint drive, Beas River canyon trail',
        'River rafting (14 km stretch), skiing at Solang, mountain biking to Gulaba',
        'Adventure camp cottage near Solang',
        'High-protein breakfast and bonfire dinner',
      ),
      'Culture & Museums': bundle(
        'Naggar Castle, Roerich Art Gallery, Himalayan Nyingmapa Buddhist temple, Manali heritage museum',
        'Kullu shawl weaving demo, local apple orchard visit, folk dance evening',
        'Naggar heritage stay with Kullu valley views',
        'Traditional Dham lunch and Himachali feast dinner',
      ),
    },
  },
  kerala: {
    baseArea: 'Alleppey & Munnar',
    arrival: {
      transfer: 'Cochin airport to Fort Kochi heritage hotel',
      tour: 'Chinese fishing nets, St. Francis Church, Mattancherry Palace, Jew Town spice lanes',
      dinner: 'Kerala seafood fry on Fort Kochi waterfront',
    },
    departure: {
      highlights: 'Marine Drive, Lulu Mall viewpoint, Cherai beach breeze walk',
      lunch: 'Syrian Christian appam lunch in Ernakulam',
      transfer: 'Hotel to Cochin international airport',
    },
    themes: {
      'Nature & Viewpoints': bundle(
        'Alleppey backwater houseboat circuit, Vembanad Lake birding channels, Kumarakom village canals',
        'Canoe village tour, toddy tapper visit, sunset shikara ride',
        'Premium houseboat overnight on Vembanad Lake',
        'Kerala sadya lunch and karimeen pollichathu dinner',
      ),
      'City Highlights': bundle(
        'Munnar tea museum, Mattupetty Dam viewpoint, Echo Point, Photo Point valley panorama',
        'Kolukkumalai sunrise jeep, tea plantation walk, spice garden tour',
        'Munnar tea-estate resort with valley views',
        'Tea-infused breakfast and plantation chef’s table dinner',
      ),
      'Wellness Day': bundle(
        'Ayurveda consultation, Shirodhara therapy session, Marari beach sunset walk',
        'Yoga by the backwaters, herbal garden tour, cooking class with local spices',
        'Ayurvedic wellness retreat villa',
        'Satvik Ayurvedic meals and detox dinner',
      ),
    },
  },
  australia: {
    baseArea: 'Sydney & Blue Mountains',
    arrival: {
      transfer: 'Sydney Kingsford Smith Airport to CBD harbour-view hotel',
      tour: 'Sydney Opera House forecourt, Circular Quay, Royal Botanic Garden, Mrs Macquarie’s Chair viewpoint',
      dinner: 'Harbour dinner cruise past Opera House and Harbour Bridge',
    },
    departure: {
      highlights: 'Bondi to Coogee coastal walk, Bondi Icebergs viewpoint, Paddington village boutiques',
      lunch: 'Fresh seafood lunch at Sydney Fish Market',
      transfer: 'Hotel to Sydney airport international terminal',
    },
    themes: {
      'City Highlights': bundle(
        'Sydney Opera House guided tour, Harbour Bridge pylon lookout, The Rocks historic precinct, Darling Harbour waterfront',
        'Harbour Bridge climb, Taronga Zoo with skyline views, Featherdale Wildlife Park koala encounter',
        'Sydney CBD harbour-view hotel',
        'Australian breakfast and harbourfront fine-dining dinner',
      ),
      'Nature & Viewpoints': bundle(
        'Blue Mountains Three Sisters lookout, Scenic World railway, Wentworth Falls track, Echo Point panorama',
        'Jenolan Caves tour, wildlife spotting at Blue Mountains, abseiling experience',
        'Blue Mountains eco-lodge with valley views',
        'Bush breakfast and Australian grill dinner',
      ),
      'Adventure Track': bundle(
        'Bondi to Coogee cliff walk, Manly Beach ferry circuit, North Head lookout, Shelly Beach snorkel point',
        'Surf lesson at Bondi, jet boat harbour ride, bridge climb express',
        'Manly beachfront boutique hotel',
        'Beach café brunch and coastal seafood dinner',
      ),
    },
  },
  dubai: {
    baseArea: 'Dubai Marina',
    arrival: {
      transfer: 'DXB airport to Dubai Marina hotel',
      tour: 'Dubai Frame, Zabeel Park, Museum of the Future exterior circuit, Dubai Mall fountain walk',
      dinner: 'Dhow cruise dinner on Dubai Creek',
    },
    departure: {
      highlights: 'Jumeirah Mosque photo stop, La Mer beach walk, City Walk boulevard',
      lunch: 'Arabic mezze lunch at Al Seef heritage district',
      transfer: 'Marina hotel to DXB airport',
    },
    themes: {
      'City Highlights': bundle(
        'Burj Khalifa At the Top, Dubai Mall, Dubai Fountain show, Old Dubai Gold & Spice Souks',
        'Desert safari with dune bashing, IMG Worlds of Adventure, Ain Dubai observation wheel',
        'Downtown Dubai luxury hotel near Burj Khalifa',
        'Arabian breakfast and rooftop Arabic fusion dinner',
      ),
      'Nature & Viewpoints': bundle(
        'Dubai Miracle Garden, Global Village pavilions, Al Qudra Love Lake, desert conservation reserve',
        'Hot-air balloon desert sunrise, falconry demo, camel caravan ride',
        'Desert resort with private pool villa',
        'Desert camp BBQ dinner and Arabic breakfast',
      ),
    },
  },
  rajasthan: {
    baseArea: 'Jaipur & Udaipur',
    arrival: {
      transfer: 'Jaipur airport to heritage haveli hotel in old city',
      tour: 'Hawa Mahal façade, City Palace complex, Jantar Mantar observatory, Pink City bazaars',
      dinner: 'Rajasthani thali dinner with live folk music',
    },
    departure: {
      highlights: 'Amber Fort courtyard, Jal Mahal lake photo stop, local handicraft emporium',
      lunch: 'Heritage haveli lunch with lake views',
      transfer: 'Udaipur or Jaipur airport transfer',
    },
    themes: {
      'City Highlights': bundle(
        'Amber Fort elephant/quarter ascent, Nahargarh Fort sunset viewpoint, Patrika Gate, Johari Bazaar',
        'Block printing workshop, hot-air balloon over Jaipur, Chokhi Dhani cultural evening',
        'Jaipur heritage palace hotel',
        'Rajasthani breakfast and royal Marwari dinner',
      ),
      'Culture & Museums': bundle(
        'Udaipur City Palace, Lake Pichola ghats, Jagdish Temple, Saheliyon-ki-Bari gardens',
        'Sunset boat ride on Lake Pichola, Bagore Ki Haveli dance show, vintage car museum',
        'Udaipur lake-view heritage hotel',
        'Mewari lunch and lakeside candlelit dinner',
      ),
    },
  },
  kenya: {
    baseArea: 'Nairobi & Maasai Mara',
    arrival: {
      transfer: 'Jomo Kenyatta airport to Nairobi hotel',
      tour: 'Giraffe Centre, Karen Blixen Museum, Kazuri Beads women\'s cooperative',
      dinner: 'Carnivore restaurant nyama choma experience',
    },
    departure: {
      highlights: 'Nairobi National Park skyline safari, David Sheldrick elephant orphanage',
      lunch: 'Nairobi coffee-house lunch at Uhuru Gardens area',
      transfer: 'Hotel to Nairobi airport',
    },
    themes: {
      'Nature & Viewpoints': bundle(
        'Maasai Mara game drives, Mara River crossing viewpoint, Maasai village cultural visit, Oloololo Escarpment panorama',
        'Hot-air balloon safari at dawn, bush walk with Maasai guides, night game drive',
        'Mara luxury tented camp on reserve edge',
        'Bush breakfast and boma dinner under stars',
      ),
      'Adventure Track': bundle(
        'Lake Nakuru flamingo shoals, Baboon Cliff lookout, rhino tracking circuit, Menengai Crater rim',
        'Crescent Island walking safari, Lake Naivasha boat ride, cycling at Hell’s Gate Gorge',
        'Lake Naivasha lakeside lodge',
        'Picnic breakfast and lakeside barbecue dinner',
      ),
    },
  },
  goa: {
    baseArea: 'North & South Goa',
    arrival: {
      transfer: 'Goa airport to Candolim beach resort',
      tour: 'Fort Aguada lighthouse, Sinquerim beach, Candolim church square evening walk',
      dinner: 'Beach shack seafood dinner with live music',
    },
    departure: {
      highlights: 'Fontainhas Latin Quarter, Sé Cathedral, Miramar beach sunset',
      lunch: 'Goan fish curry rice lunch in Panjim',
      transfer: 'Resort to Goa airport',
    },
    themes: {
      'City Highlights': bundle(
        'Basilica of Bom Jesus, Se Cathedral, Old Goa UNESCO churches, Panjim riverfront promenade',
        'Spice plantation tour, Mandovi river cruise, Feni tasting session',
        'Heritage Portuguese villa stay in Fontainhas',
        'Goan breakfast and traditional fish curry dinner',
      ),
      'Nature & Viewpoints': bundle(
        'Dudhsagar Falls viewpoint, Mollem National Park, spice plantation trail, Tambdi Surla Mahadev Temple',
        'Dudhsagar jeep safari, kayaking on Sal backwaters, Cotigao wildlife sanctuary walk',
        'Eco-resort near Western Ghats foothills',
        'Plantation lunch and Goan village dinner',
      ),
    },
  },
};

export function normalizeDestinationKey(hub: string): string {
  const h = hub.toLowerCase();
  if (h.includes('bali') || h.includes('indonesia')) return 'bali';
  if (h.includes('manali') || h.includes('himachal') || h.includes('shimla')) return 'manali';
  if (h.includes('kerala') || h.includes('kochi') || h.includes('munnar') || h.includes('alleppey')) return 'kerala';
  if (h.includes('australia') || h.includes('sydney') || h.includes('melbourne')) return 'australia';
  if (h.includes('dubai') || h.includes('uae') || h.includes('emirates')) return 'dubai';
  if (h.includes('rajasthan') || h.includes('jaipur') || h.includes('udaipur') || h.includes('jodhpur')) return 'rajasthan';
  if (h.includes('kenya') || h.includes('nairobi') || h.includes('mara')) return 'kenya';
  if (h.includes('goa')) return 'goa';
  if (h.includes('gujarat') || h.includes('ahmedabad') || h.includes('kutch')) return 'gujarat';
  if (h.includes('thailand') || h.includes('bangkok') || h.includes('phuket')) return 'thailand';
  if (h.includes('kashmir') || h.includes('srinagar') || h.includes('gulmarg')) return 'kashmir';
  if (h.includes('ladakh') || h.includes('leh')) return 'ladakh';
  return 'generic';
}

function genericBundle(hub: string, theme: string, day: number): DaySightBundle {
  const area = hub.trim() || 'destination';
  const seed = day * 3;
  const sights = [
    `${area} old town heritage quarter & main bazaar`,
    `${area} panoramic city viewpoint & waterfront promenade`,
    `${area} famous landmark circuit with local guide`,
    `${area} cultural district museums and craft lanes`,
  ];
  const optional = [
    `${area} food walking tour with street tastings`,
    `Half-day countryside excursion from ${area}`,
    `Sunset viewpoint drive and photo stops`,
  ];
  return bundle(
    [sights[seed % sights.length], sights[(seed + 1) % sights.length], sights[(seed + 2) % sights.length]].join(', '),
    optional.join(', '),
    `${area} centrally located ${theme.toLowerCase()} hotel`,
    'Daily breakfast and curated local dinner experience',
  );
}

// Lightweight profiles for remaining keys
PROFILES.gujarat = {
  baseArea: 'Ahmedabad & Kutch',
  arrival: {
    transfer: 'Sardar Vallabhbhai Patel airport to heritage hotel in old city',
    tour: 'Sabarmati Ashram, Adalaj Stepwell, Old City pol houses, Manek Chowk night market',
    dinner: 'Gujarati thali dinner with undhiyu and local sweets',
  },
  departure: {
    highlights: 'Akshardham Gandhinagar, Indroda Nature Park, Sabarmati riverfront walk',
    lunch: 'Ahmedabad street-food lunch tour finale',
    transfer: 'Hotel to Ahmedabad airport',
  },
  themes: {
    'City Highlights': bundle(
      'Rani ki Vav stepwell, Modhera Sun Temple, Patan patola weaving centre, Ahmedabad heritage walk',
      'Kutch white desert day trip, mirror-work craft village, folk music evening',
      'Ahmedabad heritage haveli hotel',
      'Gujarati breakfast and royal Kathiawadi dinner',
    ),
    'Culture & Museums': bundle(
      'Great Rann of Kutch sunset, Kala Dungar viewpoint, Bhuj Aina Mahal, local artisan villages',
      'Camel cart ride on salt flats, handicraft workshop, star-gazing on white desert',
      'Bhuj palace-style desert camp',
      'Kutchi Dham lunch and desert campfire dinner',
    ),
  },
};

PROFILES.thailand = {
  baseArea: 'Bangkok & Phuket',
  arrival: {
    transfer: 'Suvarnabhumi airport to riverside Bangkok hotel',
    tour: 'Grand Palace, Wat Pho Reclining Buddha, Wat Arun riverside temple, Chao Phraya ferry ride',
    dinner: 'Rooftop dinner with Chao Phraya river views',
  },
  departure: {
    highlights: 'Chatuchak market highlights, Jim Thompson House, Lumphini Park walk',
    lunch: 'Boat noodle alley lunch near Victory Monument',
    transfer: 'Hotel to Bangkok airport',
  },
  themes: {
    'City Highlights': bundle(
      'Wat Phra Kaew, Emerald Buddha hall, Wat Pho, Wat Traimit Golden Buddha, Yaowarat Chinatown food street',
      'Tuk-tuk night lights tour, Muay Thai boxing show, Chao Phraya dinner cruise',
      'Bangkok riverside boutique hotel',
      'Thai breakfast and Michelin street-food dinner tour',
    ),
    'Nature & Viewpoints': bundle(
      'Phi Phi Islands Maya Bay, Viking Cave, Monkey Beach, Pileh Lagoon snorkel stop',
      'James Bond Island long-tail tour, sea kayaking in Phang Nga Bay, elephant sanctuary visit',
      'Phuket beachfront resort at Patong/Kata',
      'Thai brunch and seafood beach barbecue dinner',
    ),
  },
};

PROFILES.kashmir = {
  baseArea: 'Srinagar & Gulmarg',
  arrival: {
    transfer: 'Srinagar airport to Dal Lake houseboat',
    tour: 'Dal Lake shikara ride, Nishat Bagh, Shalimar Bagh Mughal gardens, old city mosques',
    dinner: 'Wazwan multi-course dinner on houseboat',
  },
  departure: {
    highlights: 'Hazratbal Shrine, Pari Mahal sunset viewpoint, handicraft emporium visit',
    lunch: 'Kahwa tea and kehwa bakery lunch in Boulevard road cafés',
    transfer: 'Houseboat to Srinagar airport',
  },
  themes: {
    'Nature & Viewpoints': bundle(
      'Gulmarg Gondola Phase I & II, Apharwat Peak snow viewpoint, Strawberry Valley meadow, Drung waterfall',
      'Skiing at Gulmarg, pony ride to Kongdoori, Tangmarg village walk',
      'Gulmarg pine-view chalet hotel',
      'Kashmiri breakfast and Rogan Josh dinner',
    ),
  },
};

PROFILES.ladakh = {
  baseArea: 'Leh & Nubra Valley',
  arrival: {
    transfer: 'Leh Kushok Bakula airport to heritage hotel (rest day acclimatisation)',
    tour: 'Shanti Stupa sunset, Leh Palace viewpoint, local market acclimatisation walk',
    dinner: 'Ladakhi thukpa and momo dinner',
  },
  departure: {
    highlights: 'Hall of Fame museum, Gurudwara Pathar Sahib, Magnetic Hill, confluence of Indus & Zanskar',
    lunch: 'Leh old town café lunch',
    transfer: 'Leh hotel to airport',
  },
  themes: {
    'Nature & Viewpoints': bundle(
      'Khardung La pass viewpoint, Nubra Valley sand dunes, Diskit Monastery giant Maitreya Buddha, Hunder camel safari',
      'Turtuk border village tour, Pangong Lake day excursion, stargazing at high-altitude camp',
      'Nubra Valley luxury desert camp',
      'Ladakhi breakfast and camp kitchen dinner',
    ),
  },
};

export function formatStructuredDetails(segment: StructuredSegment): string {
  return `${segment.category}\n${segment.places}`;
}

export type PlanSegmentKey = 'sightseeing' | 'optional' | 'overnight' | 'meals';

function segmentPlacesFromBundle(bundle: DaySightBundle, key: PlanSegmentKey): string {
  switch (key) {
    case 'sightseeing':
      return bundle.sightseeing.places;
    case 'optional':
      return bundle.optional.places;
    case 'overnight':
      return bundle.overnight.places;
    case 'meals':
      return bundle.meals.places;
  }
}

/** All landmark phrases for a segment type across arrival, departure, and theme bundles. */
export function getPlacesPool(hub: string, segmentKey: PlanSegmentKey): string[] {
  const key = normalizeDestinationKey(hub);
  const profile = PROFILES[key];
  const pool: string[] = [];

  const pushCsv = (csv: string | undefined) => {
    if (csv?.trim()) pool.push(...splitPlacesList(csv));
  };

  if (!profile) {
    for (let day = 1; day <= 12; day += 1) {
      pushCsv(segmentPlacesFromBundle(genericBundle(hub, 'City Highlights', day), segmentKey));
    }
    return pool;
  }

  if (segmentKey === 'sightseeing') {
    pushCsv(profile.arrival.transfer);
    pushCsv(profile.arrival.tour);
    pushCsv(profile.departure.highlights);
  } else if (segmentKey === 'optional') {
    const arrival = profile.arrival as typeof profile.arrival & { evening?: string };
    pushCsv(arrival.evening);
  } else if (segmentKey === 'overnight') {
    const arrival = profile.arrival as typeof profile.arrival & { overnight?: string };
    pushCsv(arrival.overnight);
  } else if (segmentKey === 'meals') {
    pushCsv(profile.arrival.dinner);
    pushCsv(profile.departure.lunch);
    pushCsv(profile.departure.transfer);
  }

  for (const themeBundle of Object.values(profile.themes)) {
    pushCsv(segmentPlacesFromBundle(themeBundle, segmentKey));
  }

  for (let day = 1; day <= 10; day += 1) {
    pushCsv(segmentPlacesFromBundle(genericBundle(hub, 'City Highlights', day), segmentKey));
  }

  return pool;
}

/** Keep only unused places; backfill from the destination pool when a segment would be empty. */
export function ensureUniquePlaces(
  places: string,
  hub: string,
  segmentKey: PlanSegmentKey,
  tracker: PlaceUsageTracker,
  minCount = 1,
): string {
  let deduped = tracker.dedupe(places);
  const shortfall = minCount - splitPlacesList(deduped).length;
  if (shortfall <= 0) return deduped;

  const fresh = tracker.pickFresh(getPlacesPool(hub, segmentKey), shortfall);
  if (!fresh) return deduped;
  return deduped ? `${deduped}, ${fresh}` : fresh;
}

/** Theme for middle exploration days — prefers destination profile themes in order. */
export function resolveMiddleDayTheme(
  hub: string,
  middleDayIndex: number,
  themeTemplates: readonly string[],
): string {
  const key = normalizeDestinationKey(hub);
  const profileThemes = Object.keys(PROFILES[key]?.themes ?? {});
  if (profileThemes.length > 0) {
    return profileThemes[middleDayIndex % profileThemes.length] ?? profileThemes[0];
  }

  const nonArrival = themeTemplates.filter((theme) => !/arrival|orientation/i.test(theme));
  const pool = nonArrival.length > 0 ? nonArrival : themeTemplates;
  return pool[middleDayIndex % pool.length] ?? 'City Highlights';
}

export function getDaySightBundle(hub: string, theme: string, day: number): DaySightBundle {
  const key = normalizeDestinationKey(hub);
  const profile = PROFILES[key];
  if (!profile) return genericBundle(hub, theme, day);

  const themeBundle =
    profile.themes[theme] ??
    profile.themes['City Highlights'] ??
    profile.themes['Nature & Viewpoints'] ??
    Object.values(profile.themes)[day % Object.values(profile.themes).length];

  return themeBundle ?? genericBundle(hub, theme, day);
}

export function getDestinationProfile(hub: string) {
  const key = normalizeDestinationKey(hub);
  return PROFILES[key] ?? null;
}

export function getArrivalCopy(hub: string) {
  const key = normalizeDestinationKey(hub);
  const profile = PROFILES[key];
  const area =
    (profile?.baseArea.split(/&|,/)[0]?.trim() ?? hub.trim()) || 'destination';

  if (!profile) {
    return {
      transfer: `${area} airport to city centre hotel`,
      tour: `${area} landmark orientation tour with main viewpoint and old town walk`,
      evening: `Exclusive reserved evening experience at ${area}'s most iconic cultural site`,
      overnight: `${area} (premium selected hotel)`,
      dinner: `Welcome drink and gourmet dinner at hotel restaurant`,
    };
  }

  const arrival = profile.arrival as typeof profile.arrival & {
    evening?: string;
    overnight?: string;
  };

  return {
    ...arrival,
    evening:
      arrival.evening ??
      `Exclusive evening cultural experience and illuminated landmark circuit in ${area}`,
    overnight: arrival.overnight ?? `${area} (premium selected hotel)`,
  };
}

export function getDepartureCopy(hub: string) {
  const key = normalizeDestinationKey(hub);
  const profile = PROFILES[key];
  if (!profile) {
    const area = hub.trim() || 'destination';
    return {
      highlights: `${area} final highlights and souvenir shopping circuit`,
      lunch: `Farewell lunch at a popular ${area} restaurant`,
      transfer: `Hotel to ${area} airport transfer`,
    };
  }
  return profile.departure;
}

export function getDestinationBaseArea(hub: string): string {
  const key = normalizeDestinationKey(hub);
  return PROFILES[key]?.baseArea ?? (hub.trim() || 'destination');
}

const PROFILE_CITIES: Record<
  string,
  { arrivalCity: string; departureCity: string; themeLocations: Record<string, string> }
> = {
  bali: {
    arrivalCity: 'Seminyak',
    departureCity: 'Ubud',
    themeLocations: {
      'City Highlights': 'Ubud',
      'Nature & Viewpoints': 'Tegallalang',
      'Culture & Museums': 'Besakih',
      'Neighborhood Gems': 'Canggu',
      'Adventure Track': 'Ayung River',
      'Wellness Day': 'Ubud',
    },
  },
  manali: {
    arrivalCity: 'Manali',
    departureCity: 'Naggar',
    themeLocations: {
      'Nature & Viewpoints': 'Solang Valley',
      'City Highlights': 'Manali',
      'Adventure Track': 'Solang Valley',
      'Culture & Museums': 'Naggar',
    },
  },
  kerala: {
    arrivalCity: 'Fort Kochi',
    departureCity: 'Kochi',
    themeLocations: {
      'Nature & Viewpoints': 'Alleppey',
      'City Highlights': 'Munnar',
      'Wellness Day': 'Marari Beach',
    },
  },
  australia: {
    arrivalCity: 'Sydney',
    departureCity: 'Sydney',
    themeLocations: {
      'City Highlights': 'Sydney',
      'Nature & Viewpoints': 'Blue Mountains',
      'Adventure Track': 'Bondi',
    },
  },
  dubai: {
    arrivalCity: 'Dubai Marina',
    departureCity: 'Dubai',
    themeLocations: {
      'City Highlights': 'Downtown Dubai',
      'Nature & Viewpoints': 'Dubai Desert',
    },
  },
  rajasthan: {
    arrivalCity: 'Jaipur',
    departureCity: 'Udaipur',
    themeLocations: {
      'City Highlights': 'Jaipur',
      'Culture & Museums': 'Udaipur',
    },
  },
  kenya: {
    arrivalCity: 'Nairobi',
    departureCity: 'Nairobi',
    themeLocations: {
      'Nature & Viewpoints': 'Maasai Mara',
      'Adventure Track': 'Lake Nakuru',
    },
  },
  goa: {
    arrivalCity: 'Candolim',
    departureCity: 'Panjim',
    themeLocations: {
      'City Highlights': 'Old Goa',
      'Nature & Viewpoints': 'Mollem',
    },
  },
  gujarat: {
    arrivalCity: 'Ahmedabad',
    departureCity: 'Ahmedabad',
    themeLocations: {
      'City Highlights': 'Patan',
      'Culture & Museums': 'Kutch',
      Heritage: 'Ahmedabad',
    },
  },
  thailand: {
    arrivalCity: 'Bangkok',
    departureCity: 'Bangkok',
    themeLocations: {
      'City Highlights': 'Bangkok',
      'Nature & Viewpoints': 'Phi Phi Islands',
    },
  },
  kashmir: {
    arrivalCity: 'Srinagar',
    departureCity: 'Srinagar',
    themeLocations: {
      'Nature & Viewpoints': 'Gulmarg',
    },
  },
  ladakh: {
    arrivalCity: 'Leh',
    departureCity: 'Leh',
    themeLocations: {
      'Nature & Viewpoints': 'Nubra Valley',
    },
  },
};

function splitBaseArea(baseArea: string): string[] {
  return baseArea
    .split(/&|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstLandmark(placesCsv: string): string {
  const first = placesCsv.split(',')[0]?.trim() ?? '';
  if (!first) return 'Local highlights circuit';
  if (first.length > 52) return `${first.slice(0, 49)}…`;
  return first;
}

function getProfileCities(key: string, profile?: DestinationProfile) {
  const configured = PROFILE_CITIES[key];
  if (configured) return configured;

  const parts = splitBaseArea(profile?.baseArea ?? '');
  const fallback = parts[0] ?? 'Destination';
  return {
    arrivalCity: fallback,
    departureCity: parts[parts.length - 1] ?? fallback,
    themeLocations: {} as Record<string, string>,
  };
}

function resolveExploreCity(
  key: string,
  profile: DestinationProfile | undefined,
  theme: string,
  day: number,
  hub: string,
): string {
  const cities = getProfileCities(key, profile);
  if (cities.themeLocations[theme]) return cities.themeLocations[theme];

  const parts = splitBaseArea(profile?.baseArea ?? hub.trim());
  if (parts.length > 1) {
    return parts[Math.max(0, (day - 2) % parts.length)];
  }
  return (parts[0] ?? hub.trim()) || 'Destination';
}

/** City + signature landmark title for a trip day. */
export function getDayExploreTitle(
  hub: string,
  day: number,
  totalDays: number,
  theme: string,
  cityOverride?: string,
): string {
  const key = normalizeDestinationKey(hub);
  const profile = PROFILES[key];
  const cities = getProfileCities(key, profile);

  if (day === 1) {
    const places = profile?.arrival.tour ?? `${hub.trim()} landmark orientation tour`;
    const city = cityOverride ?? cities.arrivalCity;
    return `${city} — ${firstLandmark(places)}`;
  }

  if (day === totalDays) {
    const places = profile?.departure.highlights ?? `${hub.trim()} farewell highlights circuit`;
    const city = cityOverride ?? cities.departureCity;
    return `${city} — ${firstLandmark(places)}`;
  }

  const bundle = getDaySightBundle(hub, theme, day);
  const city = cityOverride ?? resolveExploreCity(key, profile, theme, day, hub);
  return `${city} — ${firstLandmark(bundle.sightseeing.places)}`;
}

export type DestinationPlanSegment = {
  category: string;
  places: string;
};

function themeForDay(
  hub: string,
  dayNumber: number,
  totalDays: number,
  dayTitle?: string,
): string {
  const key = normalizeDestinationKey(hub);
  const themes = Object.keys(PROFILES[key]?.themes ?? {});
  const legacyTheme = dayTitle?.replace(/^Day\s+\d+\s*:\s*/i, '').trim();
  if (legacyTheme && themes.includes(legacyTheme)) return legacyTheme;
  if (themes.length === 0) return 'City Highlights';
  if (dayNumber > 1 && dayNumber < totalDays) {
    const middleIndex = dayNumber - 2;
    return themes[middleIndex % themes.length] ?? 'City Highlights';
  }
  return themes[(dayNumber - 1) % themes.length] ?? 'City Highlights';
}

function cityFromDayTitle(dayTitle?: string): string | null {
  if (!dayTitle?.trim()) return null;
  const stripped = dayTitle.replace(/^Day\s+\d+\s*:\s*/i, '').trim();
  const sep = stripped.indexOf(' — ');
  const city = sep === -1 ? stripped : stripped.slice(0, sep).trim();
  if (!city || /^day\s+\d+/i.test(city)) return null;
  if (/^(arrival|departure|orientation|balanced|family|luxury)/i.test(city)) return null;
  if (/highlights|viewpoints|adventure|culture|wellness|heritage|track|gems|moments/i.test(city)) {
    return null;
  }
  return city;
}

/** Destination-specific content for the four client plan segments on a day. */
export function getDestinationDayPlanSegments(
  hub: string,
  dayNumber: number,
  totalDays: number,
  dayTitle?: string,
  placeTracker?: PlaceUsageTracker,
): DestinationPlanSegment[] {
  const key = normalizeDestinationKey(hub);
  const profile = PROFILES[key];
  const cities = getProfileCities(key, profile);
  const dayCity = cityFromDayTitle(dayTitle);

  const unique = (
    places: string,
    segmentKey: PlanSegmentKey,
    minCount = 1,
  ): string =>
    placeTracker
      ? ensureUniquePlaces(places, hub, segmentKey, placeTracker, minCount)
      : places;

  if (dayNumber === 1) {
    const copy = getArrivalCopy(hub);
    const stayCity = dayCity ?? cities.arrivalCity;
    return [
      {
        category: 'SIGHTSEEING INCLUDED',
        places: unique(`${copy.transfer}; ${copy.tour}`, 'sightseeing', 2),
      },
      { category: 'EVENING EXPERIENCE', places: unique(copy.evening, 'optional', 1) },
      {
        category: 'OVERNIGHT STAY',
        places: unique(copy.overnight || `${stayCity} (premium selected hotel)`, 'overnight', 1),
      },
      { category: 'MEALS INCLUDED', places: unique(copy.dinner, 'meals', 1) },
    ];
  }

  if (dayNumber === totalDays && totalDays > 1) {
    const copy = getDepartureCopy(hub);
    const stayCity = dayCity ?? cities.departureCity;
    return [
      { category: 'SIGHTSEEING INCLUDED', places: unique(copy.highlights, 'sightseeing', 2) },
      {
        category: 'EVENING EXPERIENCE',
        places: unique(`Farewell heritage walk and souvenir circuit in ${stayCity}`, 'optional', 1),
      },
      {
        category: 'OVERNIGHT STAY',
        places: unique(`${stayCity} (premium selected hotel until departure)`, 'overnight', 1),
      },
      {
        category: 'MEALS INCLUDED',
        places: unique(`${copy.lunch}; ${copy.transfer}`, 'meals', 1),
      },
    ];
  }

  const theme = themeForDay(hub, dayNumber, totalDays, dayTitle);
  const bundle = getDaySightBundle(hub, theme, dayNumber);
  const stayCity = dayCity ?? resolveExploreCity(key, profile, theme, dayNumber, hub);
  const overnight =
    bundle.overnight.places.toLowerCase().includes(stayCity.toLowerCase())
      ? bundle.overnight.places
      : `${stayCity} — ${bundle.overnight.places}`;

  return [
    {
      category: 'SIGHTSEEING INCLUDED',
      places: unique(bundle.sightseeing.places, 'sightseeing', 2),
    },
    { category: 'EVENING EXPERIENCE', places: unique(bundle.optional.places, 'optional', 1) },
    { category: 'OVERNIGHT STAY', places: unique(overnight, 'overnight', 1) },
    { category: 'MEALS INCLUDED', places: unique(bundle.meals.places, 'meals', 1) },
  ];
}
