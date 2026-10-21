import React, { useEffect, useState } from 'react';
import { BrandLockup } from './BrandLockup';
import { BrandMark } from './BrandMark';

// Shown on every full page load: the car races in from the left trailing
// smoke, pauses in the middle while the wordmark rises, then zooms off to the
// right (timings in index.css under "KidRide splash"). With reduced motion the
// static lockup shows briefly instead.

const SHOW_MS = 2400;
const FADE_MS = 250;

const prefersReducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export const SplashLoader: React.FC = () => {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'done'>('show');

  useEffect(() => {
    const showFor = prefersReducedMotion() ? 600 : SHOW_MS;
    const leave = setTimeout(() => setPhase('leaving'), showFor);
    const done = setTimeout(() => setPhase('done'), showFor + FADE_MS);
    return () => { clearTimeout(leave); clearTimeout(done); };
  }, []);

  if (phase === 'done') return null;
  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-surface transition-opacity duration-300 ${phase === 'leaving' ? 'opacity-0' : 'opacity-100'}`}
      role="status"
      aria-label="Loading KidRide"
    >
      <div className="kr-splash">
        <div className="kr-splash-smoke" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}
        </div>
        <BrandLockup size={120} />
      </div>
    </div>
  );
};

/** The mark with a pulsing bolt, for loading screens (not used yet). */
export const BrandLoader: React.FC<{ size?: number; label?: string }> = ({ size = 96, label = 'Loading' }) => (
  <span className="kr-loader inline-flex" role="status" aria-label={label}>
    <BrandMark size={size} />
  </span>
);
