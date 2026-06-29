import { countryDialCodes, defaultCountryCode, getCountryByCode } from "@/data/country-codes";

export function formatFullPhone(countryCode: string, localNumber: string): string {
  const dial = getCountryByCode(countryCode).dial;
  const digits = localNumber.replace(/\D/g, "");
  if (!digits) return "";
  return `${dial}${digits}`;
}

export function parsePhoneNumber(full: string | null | undefined): {
  countryCode: string;
  localNumber: string;
} {
  const trimmed = (full ?? "").trim();
  if (!trimmed) {
    return { countryCode: defaultCountryCode, localNumber: "" };
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return { countryCode: defaultCountryCode, localNumber: "" };
  }

  const sorted = [...countryDialCodes].sort(
    (a, b) => b.dial.replace(/\D/g, "").length - a.dial.replace(/\D/g, "").length
  );

  for (const country of sorted) {
    const dialDigits = country.dial.replace(/\D/g, "");
    if (digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
      return {
        countryCode: country.code,
        localNumber: digits.slice(dialDigits.length),
      };
    }
  }

  return { countryCode: defaultCountryCode, localNumber: digits };
}
