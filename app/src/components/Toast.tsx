"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { explorerUrl } from "@/lib/config";
import { shortAddr } from "@/lib/format";

export type ToastKind = "pending" | "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  txSig?: string;
}

interface ToastApi {
  push: (t: Omit<Toast, "id">) => number;
  update: (id: number, patch: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const AUTO_DISMISS_MS = 7000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const scheduleAutoDismiss = useCallback(
    (id: number) => {
      if (timers.current[id]) clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { ...t, id }]);
      if (t.kind !== "pending") scheduleAutoDismiss(id);
      return id;
    },
    [scheduleAutoDismiss],
  );

  const update = useCallback(
    (id: number, patch: Partial<Omit<Toast, "id">>) => {
      setToasts((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      if (patch.kind && patch.kind !== "pending") scheduleAutoDismiss(id);
    },
    [scheduleAutoDismiss],
  );

  const api = useMemo<ToastApi>(() => ({ push, update, dismiss }), [push, update, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Sits above the mobile bottom tab bar; back to the corner once the bar is gone (≥ md). */}
      <div className="pointer-events-none fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2.5 md:bottom-4">
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ACCENT: Record<ToastKind, string> = {
  pending: "var(--flood)",
  success: "var(--yes)",
  error: "var(--alert)",
  info: "var(--chalk-dim)",
};

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const accent = ACCENT[toast.kind];
  return (
    <div
      role="status"
      className="panel pointer-events-auto flex animate-rise-in items-start gap-3 p-3.5"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span className="mt-0.5 shrink-0" aria-hidden style={{ color: accent }}>
        {toast.kind === "pending" ? (
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : toast.kind === "success" ? (
          <Check />
        ) : toast.kind === "error" ? (
          <Cross />
        ) : (
          <Dot />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-chalk">{toast.title}</p>
        {toast.message && <p className="mt-0.5 break-words text-xs text-mist">{toast.message}</p>}
        {toast.txSig && (
          <a
            href={explorerUrl("tx", toast.txSig)}
            target="_blank"
            rel="noreferrer"
            className="led mt-1 inline-block text-xs text-flood underline-offset-2 hover:underline"
          >
            {shortAddr(toast.txSig, 6, 6)} ↗
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md px-1 text-mist transition hover:text-chalk"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Cross() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function Dot() {
  return <span className="block h-2.5 w-2.5 rounded-full bg-current" />;
}
