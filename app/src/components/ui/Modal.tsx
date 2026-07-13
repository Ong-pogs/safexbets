"use client";

import { useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Lightweight accessible modal: backdrop click + Escape to close, body scroll lock. */
export function Modal({ open, onClose, title, subtitle, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-pitch-900/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="panel relative z-10 w-full max-w-md animate-rise-in overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-chalk">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-mist">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-mist transition hover:bg-white/5 hover:text-chalk"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>
  );
}
