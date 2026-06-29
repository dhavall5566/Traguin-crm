"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import {
  countryDialCodes,
  defaultCountryCode,
  getCountryByCode,
  type CountryDialCode,
} from "@/data/country-codes";
import { cn } from "@/lib/utils";

type PhoneCountrySelectProps = {
  value: string;
  onChange: (code: string) => void;
  className?: string;
  variant?: "dark" | "form" | "crm";
  disabled?: boolean;
};

const triggerClass: Record<NonNullable<PhoneCountrySelectProps["variant"]>, string> = {
  dark: "border border-white/15 bg-white/10 text-white hover:bg-white/18",
  form: "border border-glass-border bg-surface text-foreground hover:border-gold/35 hover:bg-surface-elevated",
  crm: "border border-border bg-secondary/80 text-foreground hover:bg-secondary",
};

const dialTextClass: Record<NonNullable<PhoneCountrySelectProps["variant"]>, string> = {
  dark: "text-white",
  form: "text-foreground",
  crm: "text-foreground",
};

const chevronClass: Record<NonNullable<PhoneCountrySelectProps["variant"]>, string> = {
  dark: "text-white/80",
  form: "text-muted",
  crm: "text-muted-foreground",
};

const menuClass: Record<NonNullable<PhoneCountrySelectProps["variant"]>, string> = {
  dark: "border border-white/20 bg-black/92 text-white shadow-2xl backdrop-blur-xl",
  form: "border border-glass-border bg-surface-elevated text-foreground shadow-[0_16px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur-xl",
  crm: "border border-border bg-background text-foreground shadow-xl",
};

const menuItemClass: Record<NonNullable<PhoneCountrySelectProps["variant"]>, string> = {
  dark: "text-white hover:bg-white/10",
  form: "text-foreground hover:bg-foreground/5",
  crm: "text-foreground hover:bg-secondary",
};

const menuDialClass: Record<NonNullable<PhoneCountrySelectProps["variant"]>, string> = {
  dark: "text-white/55",
  form: "text-muted",
  crm: "text-muted-foreground",
};

export function PhoneCountrySelect({
  value,
  onChange,
  className,
  variant = "dark",
  disabled = false,
}: PhoneCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; minWidth: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = getCountryByCode(value || defaultCountryCode);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 8,
      left: rect.left,
      minWidth: Math.max(rect.width, 248),
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((e.target as HTMLElement).closest?.(`[data-country-menu="${listboxId}"]`)) return;
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleReposition = () => updateMenuPosition();
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, listboxId]);

  const selectCountry = (country: CountryDialCode) => {
    onChange(country.code);
    setOpen(false);
  };

  const menu =
    open && menuStyle
      ? createPortal(
          <ul
            id={listboxId}
            data-country-menu={listboxId}
            role="listbox"
            aria-label="Country code"
            style={{
              position: "fixed",
              top: menuStyle.top,
              left: menuStyle.left,
              minWidth: menuStyle.minWidth,
              zIndex: 200,
            }}
            className={cn("max-h-56 overflow-y-auto rounded-xl py-1", menuClass[variant])}
          >
            {countryDialCodes.map((country) => {
              const isSelected = country.code === selected.code;
              return (
                <li key={country.code} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                      menuItemClass[variant],
                      isSelected && (variant === "dark" ? "bg-white/10" : "bg-foreground/8")
                    )}
                    onClick={() => selectCountry(country)}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {country.flag}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{country.name}</span>
                    <span className={cn("shrink-0 text-xs tabular-nums", menuDialClass[variant])}>
                      {country.dial}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-9 min-w-[4.75rem] items-center gap-1 rounded-full px-2 transition-colors sm:min-w-[5.5rem] sm:gap-1.5 sm:px-2.5",
          triggerClass[variant],
          disabled && "cursor-not-allowed opacity-60"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
      >
        <span className="text-base leading-none sm:text-lg" aria-hidden>
          {selected.flag}
        </span>
        <span
          className={cn(
            "text-xs font-semibold whitespace-nowrap tabular-nums sm:text-sm",
            dialTextClass[variant]
          )}
        >
          {selected.dial}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 transition-transform",
            chevronClass[variant],
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {menu}
    </div>
  );
}
