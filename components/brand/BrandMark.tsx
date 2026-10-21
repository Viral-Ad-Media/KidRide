import React, { useId } from 'react';

// The KidRide mark: a low sky-blue fastback with a smiling child in the back
// window and a marigold lightning streak off the rear. Layers carry the class
// names car / zap / child / wheel so brand.css can animate them. Gradient and
// filter ids are prefixed per instance because the mark can appear more than
// once on a page.

interface BrandMarkProps {
  /** Width in px; the height follows the 184:76 artwork. */
  size?: number;
  /** Plays the drive-in animation (see brand.css). */
  animate?: boolean;
  /** Accessible name; omit when a visible wordmark sits next to it. */
  title?: string;
  className?: string;
}

const Wheel: React.FC<{ cx: number; tyre: string; rim: string }> = ({ cx, tyre, rim }) => (
  <g className="wheel">
    <circle cx={cx} cy={70} r={12.5} fill={`url(#${tyre})`} />
    <circle cx={cx} cy={70} r={7.5} fill={`url(#${rim})`} />
    <circle cx={cx} cy={70} r={2.6} fill="#14213D" />
    <rect x={cx - 0.8} y={60.5} width={1.6} height={4} fill="#14213D" opacity={0.8} />
  </g>
);

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 48, animate = false, title, className = '' }) => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ref = (name: string) => `${id}-${name}`;
  const zapPoints = '30,50 8,43 15,51 -2,49 22,62 15,55 30,59';

  return (
    <svg
      viewBox="-4 14 184 76"
      width={size}
      height={(size * 76) / 184}
      className={`kr-mark ${animate ? 'kr-mark--animate' : ''} ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      overflow="visible"
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={ref('body')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B5E9FF" />
          <stop offset="0.3" stopColor="#38BDF8" />
          <stop offset="0.7" stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id={ref('glass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6FBFF" />
          <stop offset="0.5" stopColor="#CBEAFB" />
          <stop offset="1" stopColor="#7CC8F0" />
        </linearGradient>
        <radialGradient id={ref('rim')} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#C9D3E0" />
          <stop offset="1" stopColor="#6B7A94" />
        </radialGradient>
        <radialGradient id={ref('tyre')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.7" stopColor="#1B2A4A" />
          <stop offset="1" stopColor="#0B1326" />
        </radialGradient>
        <radialGradient id={ref('head')} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFD866" />
          <stop offset="1" stopColor="#F59E0B" />
        </radialGradient>
        <linearGradient id={ref('zapg')} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#FFD44D" />
          <stop offset="1" stopColor="#FFB703" stopOpacity="0.85" />
        </linearGradient>
        <filter id={ref('soft')} x="-20%" y="-50%" width="140%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={ref('glow')} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      <g className="car">
        <g transform="rotate(-3 94 60)">
          {/* ground shadow */}
          <ellipse cx="96" cy="82" rx="66" ry="5" fill="#14213D" opacity="0.22" filter={`url(#${ref('soft')})`} />
          {/* speed streaks */}
          <rect x="2" y="60" width="16" height="2.4" rx="1.2" fill="#38BDF8" opacity="0.7" />
          <rect x="8" y="68" width="10" height="2.4" rx="1.2" fill="#38BDF8" opacity="0.5" />
          {/* lightning streak */}
          <polygon className="zap" points={zapPoints} fill="#FFB703" opacity="0.6" filter={`url(#${ref('glow')})`} />
          <polygon className="zap" points={zapPoints} fill={`url(#${ref('zapg')})`} />
          {/* wheel arches */}
          <circle cx="50" cy="70" r="15" fill="#0B2A4A" />
          <circle cx="138" cy="70" r="15" fill="#0B2A4A" />
          {/* body */}
          <path fill={`url(#${ref('body')})`} d="M20 70 C14 66 16 54 30 50 L40 48 C50 30 68 22 92 22 L100 22 C118 22 130 32 142 42 L158 46 C166 48 170 56 168 66 C167 72 162 74 150 74 L30 74 C24 74 21 72 20 70 Z" />
          <path fill="#0369A1" opacity="0.5" d="M26 64 L162 64 C163 70 160 74 150 74 L30 74 C25 74 23 69 26 64 Z" />
          <path stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.55" d="M34 53 C70 47 120 45 158 50" />
          <path stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.75" d="M70 27 C80 25 96 25 106 26" />
          {/* windows */}
          <path fill={`url(#${ref('glass')})`} d="M46 47 C52 36 64 28 80 27 L93 27 L93 47 Z" />
          <path fill={`url(#${ref('glass')})`} d="M98 27 L103 27 C116 27 126 34 134 43 L98 47 Z" />
          <path fill="#FFFFFF" opacity="0.5" d="M104 29 L112 29 L124 40 L116 40 Z" />
          <path fill="#FFFFFF" opacity="0.45" d="M58 32 L52 44 L58 44 L66 30 Z" />
          {/* the child in the back window */}
          <g className="child">
            <circle cx="74" cy="39" r="9" fill={`url(#${ref('head')})`} />
            <circle cx="80" cy="31.5" r="2.8" fill="#F59E0B" />
            <circle cx="71" cy="38" r="1.3" fill="#14213D" />
            <circle cx="77" cy="38" r="1.3" fill="#14213D" />
            <path d="M71 42 Q74 45 77 42" stroke="#14213D" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
          {/* door seam and handle */}
          <path d="M96 48 C96 54 96 60 97 64" stroke="#0369A1" strokeWidth="1.4" fill="none" opacity="0.7" />
          <rect x="100" y="52" width="7" height="2.4" rx="1.2" fill="#E6F6FF" opacity="0.9" />
          {/* lights */}
          <ellipse cx="162" cy="54" rx="4.5" ry="3" fill="#FFF3B0" />
          <ellipse cx="162" cy="54" rx="4.5" ry="3" fill="#FFB703" opacity="0.7" filter={`url(#${ref('glow')})`} />
          <rect x="20" y="53" width="4" height="6" rx="2" fill="#D7263D" />
          <Wheel cx={50} tyre={ref('tyre')} rim={ref('rim')} />
          <Wheel cx={138} tyre={ref('tyre')} rim={ref('rim')} />
        </g>
      </g>
    </svg>
  );
};
