import React, { useEffect, useState } from 'react';
import { BrandLockup } from './BrandLockup';
import { BrandMark } from './BrandMark';

// Shown once per browser session on first load: the car drives in, wheels
// spin, the bolt flickers, the child bobs and the wordmark fades up (brand.css).
// With reduced motion the static lockup shows briefly instead.

const SESSION_KEY = 'kidride_splash_seen';
const SHOW_MS = 1400;
const FADE_MS = 300;

const alreadySeen = () => { try { return window.sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; } };
const markSeen = () => { try { window.sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* not remembered */ } };
const prefersReducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export const SplashLoader: React.FC = () => {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'done'>(() => (alreadySeen() ? 'done' : 'show'));

  useEffect(() => {
    if (phase === 'done') return;
    markSeen();
    const reduced = prefersReducedMotion();
    const leave = setTimeout(() => setPhase('leaving'), reduced ? 500 : SHOW_MS + 250);
    const done = setTimeout(() => setPhase('done'), (reduced ? 500 : SHOW_MS + 250) + FADE_MS);
    return () => { clearTimeout(leave); clearTimeout(done); };
  }, []);

  if (phase === 'done') return null;
  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-surface transition-opacity duration-300 ${phase === 'leaving' ? 'opacity-0' : 'opacity-100'}`}
      role="status"
      aria-label="Loading KidRide"
    >
      <div className="kr-splash">
        <BrandLockup size={120} animate />
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
