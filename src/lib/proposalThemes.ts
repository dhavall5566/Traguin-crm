export type ProposalThemeId = 'luxury' | 'classic' | 'emerald' | 'sunset';

export interface ProposalTheme {
  id: ProposalThemeId;
  name: string;
  description: string;
  swatch: string;
  page: string;
  hero: string;
  orbA: string;
  orbB: string;
  badge: string;
  title: string;
  subtitle: string;
  timeline: string;
  dayBadge: string;
  dayTitle: string;
  dayDesc: string;
  itemCard: string;
  itemIcon: string;
  itemTitle: string;
  itemDetail: string;
  footer: string;
  price: string;
  divider: string;
}

export const PROPOSAL_THEMES: Record<ProposalThemeId, ProposalTheme> = {
  luxury: {
    id: 'luxury',
    name: 'Luxury Noir',
    description: 'Premium dark canvas with gold highlights',
    swatch: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-amber-900',
    page: 'bg-gradient-to-b from-slate-950 via-indigo-950/40 to-slate-950 text-slate-100',
    hero: 'border-amber-500/20 bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-amber-950/30',
    orbA: 'bg-indigo-500/20',
    orbB: 'bg-amber-500/15',
    badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    title: 'text-white',
    subtitle: 'text-slate-300',
    timeline: 'bg-indigo-500/30',
    dayBadge: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30',
    dayTitle: 'text-white',
    dayDesc: 'text-slate-400 border-l-indigo-500/40',
    itemCard: 'bg-slate-900/70 border border-slate-700/50 hover:border-indigo-500/30',
    itemIcon: 'bg-indigo-500/15 text-indigo-300',
    itemTitle: 'text-slate-100',
    itemDetail: 'text-slate-500',
    footer: 'bg-slate-900/80 border-t border-amber-500/20',
    price: 'text-amber-300',
    divider: 'border-slate-700/60',
  },
  classic: {
    id: 'classic',
    name: 'Classic Light',
    description: 'Clean white layout for corporate clients',
    swatch: 'bg-gradient-to-br from-slate-50 via-white to-sky-100',
    page: 'bg-gradient-to-b from-slate-50 to-white text-slate-900',
    hero: 'border-sky-200 bg-gradient-to-r from-white via-sky-50/80 to-white',
    orbA: 'bg-sky-200/60',
    orbB: 'bg-blue-100/80',
    badge: 'bg-sky-100 text-sky-700 border border-sky-200',
    title: 'text-slate-900',
    subtitle: 'text-slate-600',
    timeline: 'bg-sky-300',
    dayBadge: 'bg-sky-600 text-white shadow-md shadow-sky-200',
    dayTitle: 'text-slate-900',
    dayDesc: 'text-slate-600 border-l-sky-300',
    itemCard: 'bg-white border border-slate-200 shadow-sm hover:shadow-md',
    itemIcon: 'bg-sky-50 text-sky-600',
    itemTitle: 'text-slate-800',
    itemDetail: 'text-slate-500',
    footer: 'bg-slate-50 border-t border-slate-200',
    price: 'text-sky-700',
    divider: 'border-slate-200',
  },
  emerald: {
    id: 'emerald',
    name: 'Valley Emerald',
    description: 'Nature-inspired greens for Kashmir & hills',
    swatch: 'bg-gradient-to-br from-emerald-950 via-teal-900 to-green-900',
    page: 'bg-gradient-to-b from-emerald-950 via-teal-950/50 to-slate-950 text-emerald-50',
    hero: 'border-emerald-500/25 bg-gradient-to-r from-emerald-950/90 via-teal-900/80 to-emerald-900/40',
    orbA: 'bg-emerald-500/20',
    orbB: 'bg-teal-400/15',
    badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
    title: 'text-white',
    subtitle: 'text-emerald-100/80',
    timeline: 'bg-emerald-500/40',
    dayBadge: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25',
    dayTitle: 'text-emerald-50',
    dayDesc: 'text-emerald-200/70 border-l-emerald-500/40',
    itemCard: 'bg-emerald-950/50 border border-emerald-800/40',
    itemIcon: 'bg-emerald-500/15 text-emerald-300',
    itemTitle: 'text-emerald-50',
    itemDetail: 'text-emerald-300/60',
    footer: 'bg-emerald-950/70 border-t border-emerald-500/25',
    price: 'text-emerald-300',
    divider: 'border-emerald-800/50',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Romance',
    description: 'Warm tones ideal for honeymoons & leisure',
    swatch: 'bg-gradient-to-br from-rose-950 via-orange-950 to-amber-900',
    page: 'bg-gradient-to-b from-rose-950 via-orange-950/60 to-slate-950 text-orange-50',
    hero: 'border-orange-400/25 bg-gradient-to-r from-rose-950/90 via-orange-900/70 to-amber-950/40',
    orbA: 'bg-rose-500/20',
    orbB: 'bg-orange-400/15',
    badge: 'bg-orange-500/15 text-orange-200 border border-orange-400/30',
    title: 'text-white',
    subtitle: 'text-orange-100/80',
    timeline: 'bg-orange-400/40',
    dayBadge: 'bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-orange-500/25',
    dayTitle: 'text-orange-50',
    dayDesc: 'text-orange-200/70 border-l-orange-400/40',
    itemCard: 'bg-rose-950/40 border border-orange-800/35',
    itemIcon: 'bg-orange-500/15 text-orange-300',
    itemTitle: 'text-orange-50',
    itemDetail: 'text-orange-300/60',
    footer: 'bg-rose-950/60 border-t border-orange-400/25',
    price: 'text-orange-300',
    divider: 'border-orange-800/40',
  },
};

export const DEFAULT_PROPOSAL_THEME: ProposalThemeId = 'classic';

export function resolveProposalTheme(theme?: string): ProposalThemeId {
  void theme;
  return DEFAULT_PROPOSAL_THEME;
}

export function buildProposalShareUrl(origin: string, itineraryId: string, theme: ProposalThemeId) {
  return `${origin}/portal/customer?itin=${itineraryId}&theme=${theme}`;
}
