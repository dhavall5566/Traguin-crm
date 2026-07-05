import { crmFetchJson } from "@/lib/api/crm-client";
import { clampListLimit } from "@/lib/api/pagination";

export type CmsPackageListItem = {
  id: string;
  slug: string;
  destination_id: string;
  destination_name: string;
  title: string;
  duration_label: string;
  price: number;
  sold_last_month: number;
  hero_media_id: string | null;
  rating: string | number | null;
  is_featured: boolean;
  featured_sort_order: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type CmsPackage = CmsPackageListItem & {
  highlights: { id: string; text: string; sort_order: number }[];
  moods: string[];
};

export function mapPackageListFromApi(item: CmsPackageListItem) {
  return {
    id: item.id,
    slug: item.slug,
    destinationId: item.destination_id,
    destinationName: item.destination_name,
    title: item.title,
    durationLabel: item.duration_label,
    price: item.price,
    soldLastMonth: item.sold_last_month,
    isFeatured: item.is_featured,
    isPublished: item.is_published,
    rating: item.rating != null ? Number(item.rating) : undefined,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export type CmsPackageListRecord = ReturnType<typeof mapPackageListFromApi>;

export type CmsPackageFilters = {
  destinations: { id: string; name: string; count: number }[];
  durations: string[];
};

export async function listCmsPackages(params?: {
  q?: string;
  published?: boolean;
  destinationId?: string;
  duration?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<CmsPackageListItem>> {
  const search = new URLSearchParams();
  search.set("limit", String(clampListLimit(params?.limit)));
  if (params?.offset != null) search.set("offset", String(params.offset));
  if (params?.q?.trim()) search.set("q", params.q.trim());
  if (params?.published != null) search.set("published", String(params.published));
  if (params?.destinationId) search.set("destination_id", params.destinationId);
  if (params?.duration) search.set("duration", params.duration);
  if (params?.minPrice != null) search.set("min_price", String(params.minPrice));
  if (params?.maxPrice != null) search.set("max_price", String(params.maxPrice));
  const qs = search.toString();
  return crmFetchJson<PaginatedResponse<CmsPackageListItem>>(
    `/api/crm/packages${qs ? `?${qs}` : ""}`,
  );
}

export async function getCmsPackageFilters(): Promise<CmsPackageFilters> {
  return crmFetchJson<CmsPackageFilters>("/api/crm/packages/filters");
}

export async function getCmsPackage(id: string): Promise<CmsPackage> {
  return crmFetchJson<CmsPackage>(`/api/crm/packages/${id}`);
}
