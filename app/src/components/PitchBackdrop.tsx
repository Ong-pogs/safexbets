/**
 * Decorative, fixed full-screen pitch markings behind everything. Pure chalk lines at low opacity
 * plus a fine grain — this is the signature "you're standing on the pitch" texture. Non-interactive.
 */
export function PitchBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <svg
        className="absolute left-1/2 top-1/2 h-[140vh] w-[140vh] -translate-x-1/2 -translate-y-1/2 opacity-[0.06]"
        viewBox="0 0 1000 1000"
        fill="none"
        stroke="#EEFBF1"
        strokeWidth="2"
      >
        {/* Halfway line + center circle + spot */}
        <line x1="0" y1="500" x2="1000" y2="500" />
        <circle cx="500" cy="500" r="130" />
        <circle cx="500" cy="500" r="6" fill="#EEFBF1" stroke="none" />
        {/* Top penalty area */}
        <rect x="290" y="0" width="420" height="150" />
        <rect x="400" y="0" width="200" height="60" />
        <path d="M410 150 A 130 130 0 0 0 590 150" />
        {/* Bottom penalty area */}
        <rect x="290" y="850" width="420" height="150" />
        <rect x="400" y="940" width="200" height="60" />
        <path d="M410 850 A 130 130 0 0 1 590 850" />
        {/* Touchline frame */}
        <rect x="20" y="20" width="960" height="960" />
      </svg>
      <div className="grain absolute inset-0" />
    </div>
  );
}
