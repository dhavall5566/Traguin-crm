/** CRM lead "Details" section — trip preferences captured after intake. */

export type LeadTravelType = "SOLO" | "FAMILY" | "MISC";
export type LeadHotelCategory = "3_STAR" | "4_STAR" | "5_STAR";
export type LeadMealCategory = "VEG" | "NON_VEG" | "JAIN";
export type LeadOccasion =
  | "ANNIVERSARY"
  | "BIRTHDAY_PARTY"
  | "MARRIAGE"
  | "RETIREMENT"
  | "NONE";
export type LeadFlightType = "ONE_WAY" | "ROUND";
export type LeadYesNo = "YES" | "NO";
export type LeadTransportation = "PVT" | "SIC";
export type LeadPackageMode = "PRE_BUILT" | "CUSTOM";

export interface LeadDetailsFields {
  travelDate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  pincode?: string;
  state?: string;
  country?: string;
  adultsCount?: number;
  childrenCount?: number;
  childrenAges?: number[];
  travelType?: LeadTravelType;
  arrivalDate?: string;
  hotelCategory?: LeadHotelCategory;
  mealCategory?: LeadMealCategory;
  travelDestination?: string;
  occasion?: LeadOccasion;
  flightType?: LeadFlightType;
  extraBaggage?: LeadYesNo;
  wheelchairAssistance?: LeadYesNo;
  visaAssistance?: LeadYesNo;
  travelInsurance?: LeadYesNo;
  transportation?: LeadTransportation;
  packageMode?: LeadPackageMode;
}

export const EMPTY_LEAD_DETAILS: LeadDetailsFields = {};

export function pickLeadDetails(lead: LeadDetailsFields): LeadDetailsFields {
  return {
    travelDate: lead.travelDate ?? undefined,
    addressLine1: lead.addressLine1 ?? undefined,
    addressLine2: lead.addressLine2 ?? undefined,
    city: lead.city ?? undefined,
    pincode: lead.pincode ?? undefined,
    state: lead.state ?? undefined,
    country: lead.country ?? undefined,
    adultsCount: lead.adultsCount ?? undefined,
    childrenCount: lead.childrenCount ?? undefined,
    childrenAges: lead.childrenAges?.length ? [...lead.childrenAges] : undefined,
    travelType: lead.travelType ?? undefined,
    arrivalDate: lead.arrivalDate ?? undefined,
    hotelCategory: lead.hotelCategory ?? undefined,
    mealCategory: lead.mealCategory ?? undefined,
    travelDestination: lead.travelDestination ?? undefined,
    occasion: lead.occasion ?? undefined,
    flightType: lead.flightType ?? undefined,
    extraBaggage: lead.extraBaggage ?? undefined,
    wheelchairAssistance: lead.wheelchairAssistance ?? undefined,
    visaAssistance: lead.visaAssistance ?? undefined,
    travelInsurance: lead.travelInsurance ?? undefined,
    transportation: lead.transportation ?? undefined,
    packageMode: lead.packageMode ?? undefined,
  };
}

function normStr(value: string | undefined): string {
  return (value ?? "").trim();
}

function normAges(ages: number[] | undefined): number[] {
  if (!ages?.length) return [];
  return ages.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n >= 0);
}

export function leadDetailsEqual(a: LeadDetailsFields, b: LeadDetailsFields): boolean {
  const left = pickLeadDetails(a);
  const right = pickLeadDetails(b);
  return (
    normStr(left.travelDate) === normStr(right.travelDate) &&
    normStr(left.addressLine1) === normStr(right.addressLine1) &&
    normStr(left.addressLine2) === normStr(right.addressLine2) &&
    normStr(left.city) === normStr(right.city) &&
    normStr(left.pincode) === normStr(right.pincode) &&
    normStr(left.state) === normStr(right.state) &&
    normStr(left.country) === normStr(right.country) &&
    (left.adultsCount ?? null) === (right.adultsCount ?? null) &&
    (left.childrenCount ?? null) === (right.childrenCount ?? null) &&
    JSON.stringify(normAges(left.childrenAges)) === JSON.stringify(normAges(right.childrenAges)) &&
    (left.travelType ?? "") === (right.travelType ?? "") &&
    normStr(left.arrivalDate) === normStr(right.arrivalDate) &&
    (left.hotelCategory ?? "") === (right.hotelCategory ?? "") &&
    (left.mealCategory ?? "") === (right.mealCategory ?? "") &&
    normStr(left.travelDestination) === normStr(right.travelDestination) &&
    (left.occasion ?? "") === (right.occasion ?? "") &&
    (left.flightType ?? "") === (right.flightType ?? "") &&
    (left.extraBaggage ?? "") === (right.extraBaggage ?? "") &&
    (left.wheelchairAssistance ?? "") === (right.wheelchairAssistance ?? "") &&
    (left.visaAssistance ?? "") === (right.visaAssistance ?? "") &&
    (left.travelInsurance ?? "") === (right.travelInsurance ?? "") &&
    (left.transportation ?? "") === (right.transportation ?? "") &&
    (left.packageMode ?? "") === (right.packageMode ?? "")
  );
}

export function leadDetailsToUpdateInput(
  details: LeadDetailsFields,
): Record<string, unknown> {
  const d = pickLeadDetails(details);
  return {
    travel_date: d.travelDate || null,
    address_line1: d.addressLine1?.trim() || null,
    address_line2: d.addressLine2?.trim() || null,
    city: d.city?.trim() || null,
    pincode: d.pincode?.trim() || null,
    state: d.state?.trim() || null,
    country: d.country?.trim() || null,
    adults_count: d.adultsCount ?? null,
    children_count: d.childrenCount ?? null,
    children_ages: d.childrenAges?.length ? d.childrenAges : null,
    travel_type: d.travelType ?? null,
    arrival_date: d.arrivalDate || null,
    hotel_category: d.hotelCategory ?? null,
    meal_category: d.mealCategory ?? null,
    travel_destination: d.travelDestination?.trim() || null,
    occasion: d.occasion ?? null,
    flight_type: d.flightType ?? null,
    extra_baggage: d.extraBaggage ?? null,
    wheelchair_assistance: d.wheelchairAssistance ?? null,
    visa_assistance: d.visaAssistance ?? null,
    travel_insurance: d.travelInsurance ?? null,
    transportation: d.transportation ?? null,
    package_mode: d.packageMode ?? null,
  };
}
