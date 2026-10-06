export function OpusMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="opus-mark-a" x1="16" y1="18" x2="104" y2="98" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FBFF" />
          <stop offset=".48" stopColor="#C4D3E8" />
          <stop offset="1" stopColor="#718FB7" />
        </linearGradient>
        <linearGradient id="opus-mark-b" x1="29" y1="101" x2="94" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6F90BD" stopOpacity=".58" />
          <stop offset=".54" stopColor="#EEF4FA" />
          <stop offset="1" stopColor="#8DA6C8" stopOpacity=".72" />
        </linearGradient>
        <radialGradient id="opus-mark-node">
          <stop stopColor="#FFFFFF" />
          <stop offset=".45" stopColor="#BFD3EE" stopOpacity=".78" />
          <stop offset="1" stopColor="#7095C5" stopOpacity="0" />
        </radialGradient>
        <filter id="opus-mark-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.7" />
        </filter>
      </defs>

      <g opacity=".28" filter="url(#opus-mark-glow)">
        <path d="M19 63C24 36 45 18 69 21C92 24 105 42 100 61C96 81 75 99 52 99C30 99 16 84 19 63Z" stroke="#9FB8D8" strokeWidth="3" />
        <path d="M37 18C57 12 83 24 91 46C99 68 84 94 61 98C40 101 20 87 20 65C20 45 35 31 52 27" stroke="#E5EDF6" strokeWidth="2.1" />
      </g>

      <path d="M16 61C21 35 43 18 66 19C88 20 104 35 103 56C102 78 82 97 58 101C35 104 18 88 16 61Z" stroke="url(#opus-mark-a)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M31 18C49 10 74 15 88 33C103 53 96 77 78 91C60 105 34 99 23 80C14 62 21 43 38 33C49 26 63 25 75 31" stroke="url(#opus-mark-b)" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M29 84C43 103 71 105 90 86C105 71 106 45 89 29C73 15 51 12 34 24" stroke="#EDF3F9" strokeOpacity=".72" strokeWidth="1.15" strokeLinecap="round" />

      <circle cx="60" cy="60" r="20" fill="#05080C" stroke="#9AB1CF" strokeOpacity=".62" strokeWidth="1.4" />
      <circle cx="60" cy="60" r="16" stroke="#EDF4FB" strokeOpacity=".14" strokeWidth="1" />

      <circle cx="22" cy="43" r="5.2" fill="url(#opus-mark-node)" />
      <circle cx="96" cy="35" r="4" fill="url(#opus-mark-node)" opacity=".78" />
      <circle cx="100" cy="75" r="4.7" fill="url(#opus-mark-node)" />
      <circle cx="37" cy="98" r="3.7" fill="url(#opus-mark-node)" opacity=".7" />
      <circle cx="61" cy="18" r="3.4" fill="url(#opus-mark-node)" />
    </svg>
  );
}

export function OpusLockup() {
  return (
    <div className="opus-lockup" aria-label="OPUS">
      <OpusMark className="opus-lockup__mark" />
      <span className="opus-lockup__word">OPUS</span>
    </div>
  );
}
