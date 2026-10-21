import React from 'react';
import { BrandMark } from './BrandMark';

// The mark with the KidRide wordmark beside it.

interface BrandLockupProps {
  /** Mark width in px; the wordmark scales with it. */
  size?: number;
  animate?: boolean;
  /** For dark backgrounds. */
  inverse?: boolean;
  className?: string;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({ size = 56, animate = false, inverse = false, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label="KidRide" role="img">
    <BrandMark size={size} animate={animate} />
    <span
      className={`kr-wordmark font-extrabold leading-none ${inverse ? 'text-white' : 'text-ink'}`}
      style={{ fontSize: Math.round(size * 0.42), letterSpacing: '-0.02em' }}
      aria-hidden="true"
    >
      KidRide
    </span>
  </span>
);
