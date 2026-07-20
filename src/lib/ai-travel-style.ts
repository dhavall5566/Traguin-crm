import type { AiTravelStyle } from '@/lib/ai-itinerary-pricing';

/** How strongly each travel style prefers itinerary theme buckets. */
export const STYLE_THEME_PRIORITY: Record<AiTravelStyle, Record<string, number>> = {
  Balanced: {
    'City Highlights': 5,
    'Nature & Viewpoints': 5,
    'Culture & Museums': 4,
    'Neighborhood Gems': 4,
    'Adventure Track': 3,
    'Wellness Day': 3,
    Heritage: 4,
  },
  Luxury: {
    'City Highlights': 5,
    'Wellness Day': 6,
    'Culture & Museums': 5,
    'Nature & Viewpoints': 4,
    'Neighborhood Gems': 3,
    'Adventure Track': 2,
    Heritage: 5,
  },
  Budget: {
    'City Highlights': 6,
    'Neighborhood Gems': 5,
    'Culture & Museums': 4,
    'Nature & Viewpoints': 4,
    'Adventure Track': 3,
    'Wellness Day': 2,
    Heritage: 4,
  },
  Adventure: {
    'Adventure Track': 10,
    'Nature & Viewpoints': 7,
    'City Highlights': 3,
    'Neighborhood Gems': 3,
    'Culture & Museums': 2,
    'Wellness Day': 1,
    Heritage: 2,
  },
  Family: {
    'City Highlights': 7,
    'Nature & Viewpoints': 6,
    'Culture & Museums': 5,
    'Neighborhood Gems': 4,
    'Adventure Track': 4,
    'Wellness Day': 3,
    Heritage: 5,
  },
  Culinary: {
    'City Highlights': 5,
    'Neighborhood Gems': 7,
    'Culture & Museums': 5,
    'Nature & Viewpoints': 3,
    'Adventure Track': 2,
    'Wellness Day': 3,
    Heritage: 4,
  },
  Relaxation: {
    'Wellness Day': 10,
    'Nature & Viewpoints': 6,
    'City Highlights': 3,
    'Neighborhood Gems': 4,
    'Culture & Museums': 2,
    'Adventure Track': 1,
    Heritage: 2,
  },
};

export function pickThemeForStyle(availableThemes: readonly string[], style: string): string {
  if (availableThemes.length === 0) return 'City Highlights';
  const priorities = STYLE_THEME_PRIORITY[style as AiTravelStyle] ?? STYLE_THEME_PRIORITY.Balanced;
  const ranked = [...availableThemes].sort((a, b) => {
    const scoreA = priorities[a] ?? 1;
    const scoreB = priorities[b] ?? 1;
    return scoreB - scoreA;
  });
  return ranked[0] ?? availableThemes[0];
}

const STYLE_HOTEL_SUFFIX: Record<AiTravelStyle, string> = {
  Balanced: '',
  Luxury: ' (luxury collection)',
  Budget: ' (value stay)',
  Adventure: ' (adventure base)',
  Family: ' (family suite)',
  Culinary: ' (foodie district)',
  Relaxation: ' (wellness retreat)',
};

const STYLE_MEAL_SUFFIX: Record<AiTravelStyle, string> = {
  Balanced: '',
  Luxury: ' · chef’s tasting menu',
  Budget: ' · local thali set menu',
  Adventure: ' · high-energy meal plan',
  Family: ' · family sharing platters',
  Culinary: ' · curated food trail',
  Relaxation: ' · light wellness menu',
};

export function applyStyleToHotelCopy(places: string, style: string): string {
  const suffix = STYLE_HOTEL_SUFFIX[style as AiTravelStyle] ?? '';
  if (!suffix || places.includes('luxury') || places.includes('value')) return places;
  return `${places}${suffix}`;
}

export function applyStyleToMealCopy(places: string, style: string): string {
  const suffix = STYLE_MEAL_SUFFIX[style as AiTravelStyle] ?? '';
  if (!suffix) return places;
  return `${places}${suffix}`;
}

export function isValidTravelStyle(style: string): style is AiTravelStyle {
  return style in STYLE_THEME_PRIORITY;
}

export function normalizeTravelStyle(style: string): AiTravelStyle {
  return isValidTravelStyle(style) ? style : 'Balanced';
}
