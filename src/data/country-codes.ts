export type CountryDialCode = {
  code: string;
  name: string;
  dial: string;
  flag: string;
};

/** India first, then common TRAGUIN travel markets alphabetically */
export const countryDialCodes: CountryDialCode[] = [
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { code: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { code: "MV", name: "Maldives", dial: "+960", flag: "🇲🇻" },
  { code: "NP", name: "Nepal", dial: "+977", flag: "🇳🇵" },
  { code: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { code: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { code: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { code: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { code: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
];

export const defaultCountryCode = "IN";

export function getCountryByCode(code: string): CountryDialCode {
  return countryDialCodes.find((c) => c.code === code) ?? countryDialCodes[0];
}
