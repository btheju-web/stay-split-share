import * as React from "react";
import { Input } from "@/components/ui/input";
import { sanitizeMoneyInput } from "@/lib/splitstay";

type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Amount field that only ever holds a clean decimal string. Uses a text input
 * (not type="number") so scroll wheels, "e"/"+"/"-" keys and locale commas
 * cannot silently corrupt the value.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, placeholder = "0.00", ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onValueChange(sanitizeMoneyInput(e.target.value))}
      onBlur={(e) => {
        const v = sanitizeMoneyInput(e.target.value);
        onValueChange(v.endsWith(".") ? v.slice(0, -1) : v);
        props.onBlur?.(e);
      }}
    />
  ),
);
MoneyInput.displayName = "MoneyInput";
