"use client";

import { useRef } from "react";

function joinClasses(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type DatePickerInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  inputClassName?: string;
};

export function DatePickerInput({
  className,
  inputClassName,
  disabled,
  id,
  onClick,
  ...props
}: DatePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input || disabled) return;
    input.focus();
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        /* Safari may throw if not triggered by user gesture */
      }
    }
  };

  return (
    <div className={joinClasses("date-picker-input relative", className)}>
      <input
        ref={inputRef}
        id={id}
        type="date"
        disabled={disabled}
        className={joinClasses("date-picker-input__field", inputClassName)}
        onClick={(event) => {
          onClick?.(event);
          openPicker();
        }}
        {...props}
      />
    </div>
  );
}
