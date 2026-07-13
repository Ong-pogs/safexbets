"use client";

import clsx from "clsx";
import { forwardRef } from "react";

type Variant = "flood" | "yes" | "no" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  flood:
    "bg-flood text-pitch-900 hover:shadow-[0_10px_26px_-10px_rgba(203,255,62,0.6)] hover:-translate-y-px",
  yes: "bg-yes text-pitch-900 hover:shadow-[0_10px_26px_-10px_rgba(47,227,154,0.6)] hover:-translate-y-px",
  no: "bg-no text-pitch-900 hover:shadow-[0_10px_26px_-10px_rgba(255,154,61,0.55)] hover:-translate-y-px",
  ghost: "bg-white/5 text-chalk hover:bg-white/10",
  outline: "border border-white/15 text-chalk hover:border-flood/60 hover:text-flood",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "flood", size = "md", loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "kit-label inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
});
