"use client";

import type { ReactNode } from "react";
import { PhoneCountrySelect } from "@/components/ui/PhoneCountrySelect";
import { LOCAL_PHONE_LENGTH, sanitizeLocalPhoneInput } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

type PhoneInputVariant = "form" | "hero" | "crm";

type PhoneInputProps = {
  id: string;
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  variant?: PhoneInputVariant;
  invalid?: boolean;
  placeholder?: string;
  autoComplete?: string;
  readOnly?: boolean;
  className?: string;
  trailing?: ReactNode;
};

const shellClass: Record<PhoneInputVariant, string> = {
  form: "rounded-xl border border-glass-border bg-input px-2 py-1.5",
  hero:
    "h-12 rounded-full border-2 border-white/55 bg-white/16 py-1 pr-1 pl-2 shadow-[0_16px_48px_rgba(0,0,0,0.45)] ring-1 ring-white/25 backdrop-blur-xl sm:pl-3",
  crm: "rounded-lg border border-border bg-secondary/50 px-2 py-1",
};

const inputClass: Record<PhoneInputVariant, string> = {
  form: "py-2 text-sm text-foreground placeholder:text-muted",
  hero: "py-0 text-sm text-white placeholder:text-white/75 sm:text-base",
  crm: "py-2 text-sm text-foreground placeholder:text-muted-foreground",
};

const dividerClass: Record<PhoneInputVariant, string> = {
  form: "bg-glass-border",
  hero: "bg-white/35",
  crm: "bg-border",
};

export function PhoneInput({
  id,
  countryCode,
  onCountryCodeChange,
  value,
  onChange,
  variant = "form",
  invalid = false,
  placeholder = "10-digit mobile number",
  autoComplete = "tel",
  readOnly = false,
  className,
  trailing,
}: PhoneInputProps) {
  const isCompact = variant === "crm";

  return (
    <div
      className={cn(
        "w-full items-center",
        isCompact
          ? cn("flex gap-1", trailing ? "pr-1" : undefined)
          : cn(
              "grid gap-x-2 sm:gap-x-3",
              trailing
                ? "grid-cols-[auto_1px_minmax(0,1fr)_auto]"
                : "grid-cols-[auto_1px_minmax(0,1fr)]",
            ),
        shellClass[variant],
        invalid && variant === "form" && "border-red-400/70 focus-within:border-red-400",
        invalid && variant === "hero" && "border-red-400/70",
        invalid && variant === "crm" && "border-red-500/70",
        readOnly && variant === "crm" && "bg-secondary/30",
        className
      )}
    >
      <PhoneCountrySelect
        value={countryCode}
        onChange={onCountryCodeChange}
        variant={variant === "hero" ? "dark" : variant === "crm" ? "crm" : "form"}
        disabled={readOnly}
      />
      {!isCompact ? (
        <span className={cn("h-6 w-px", dividerClass[variant])} aria-hidden />
      ) : null}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(sanitizeLocalPhoneInput(e.target.value))}
        readOnly={readOnly}
        placeholder={placeholder}
        maxLength={LOCAL_PHONE_LENGTH}
        pattern="[0-9]{10}"
        className={cn(
          "min-w-0 h-full w-full flex-1 border-0 bg-transparent outline-none",
          inputClass[variant],
          readOnly && "cursor-not-allowed text-muted-foreground"
        )}
        aria-invalid={invalid || undefined}
      />
      {trailing}
    </div>
  );
}
