"use client";

/**
 * The primary IA, shared by the desktop navbar and the mobile bottom tab bar so the two can never
 * drift. `isActive` gets the current pathname (from `usePathname`).
 */

export interface NavItem {
  key: "matches" | "match-center" | "my-bets";
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
  icon: (props: { className?: string }) => React.ReactNode;
}

/** Featured fixture: the bundled Brazil–Norway replay always works, even with no token/markets. */
export const FEATURED_FIXTURE_ID = 18187298;

export const NAV_ITEMS: NavItem[] = [
  {
    key: "matches",
    label: "Matches",
    href: "/matches",
    isActive: (p) => p === "/matches" || p.startsWith("/matches/"),
    icon: FixturesIcon,
  },
  {
    key: "match-center",
    label: "Match Center",
    href: `/match/${FEATURED_FIXTURE_ID}`,
    isActive: (p) => p.startsWith("/match/"),
    icon: PitchIcon,
  },
  {
    key: "my-bets",
    label: "My Bets",
    href: "/my-bets",
    isActive: (p) => p === "/my-bets" || p.startsWith("/my-bets/"),
    icon: TicketIcon,
  },
];

/* Chalk-line icons, drawn to match the pitch-markings motif (1.6 stroke, currentColor). */

function FixturesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <circle cx="4.5" cy="5.5" r="1.9" />
      <path d="M9.5 5.5h8" strokeLinecap="round" />
      <circle cx="4.5" cy="11" r="1.9" />
      <path d="M9.5 11h8" strokeLinecap="round" />
      <circle cx="4.5" cy="16.5" r="1.9" />
      <path d="M9.5 16.5h8" strokeLinecap="round" />
    </svg>
  );
}

function PitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <rect x="2.5" y="4" width="17" height="14" rx="1.5" />
      <path d="M11 4v14" />
      <circle cx="11" cy="11" r="2.6" />
    </svg>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h13A1.5 1.5 0 0 1 19 7.5v1.8a1.7 1.7 0 0 0 0 3.4v1.8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 14.5v-1.8a1.7 1.7 0 0 0 0-3.4z" />
      <path d="M8 9.5l2 2 4-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
