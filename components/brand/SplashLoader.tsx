import React, { useEffect, useRef, useState } from 'react';
import { BrandLockup } from './BrandLockup';
import { BrandMark } from './BrandMark';

// Shown on every full page load: a bright day scene (sky, sun, soft clouds,
// a road across the bottom) with the car racing in from the left trailing
// smoke, pausing in the middle while the wordmark rises, then zooming off to
// the right (timings in index.css under "KidRide splash"). With reduced
// motion the static scene shows briefly instead.

const SHOW_MS = 2400;
const FADE_MS = 250;

const prefersReducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export const SplashLoader: React.FC = () => {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'done'>('show');
  const [go, setGo] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);

  // Start the clock (and the CSS animations) only once the stylesheet has
  // reached the scene, so a slow dev server cannot eat the animation.
  useEffect(() => {
    let frame = 0;
    const waitForStyles = () => {
      const el = sceneRef.current;
      if (el && getComputedStyle(el).position === 'fixed') setGo(true);
      else frame = requestAnimationFrame(waitForStyles);
    };
    waitForStyles();
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!go) return;
    const showFor = prefersReducedMotion() ? 600 : SHOW_MS;
    const leave = setTimeout(() => setPhase('leaving'), showFor);
    const done = setTimeout(() => setPhase('done'), showFor + FADE_MS);
    return () => { clearTimeout(leave); clearTimeout(done); };
  }, [go]);

  if (phase === 'done') return null;
  return (
    <div
      ref={sceneRef}
      className={`kr-scene ${go ? 'kr-go' : ''} fixed inset-0 z-[200] overflow-hidden transition-opacity duration-300 ${phase === 'leaving' ? 'opacity-0' : 'opacity-100'}`}
      role="status"
      aria-label="Loading KidRide"
    >
      <span className="kr-sun" aria-hidden="true" />
      <span className="kr-cloud kr-cloud-1" aria-hidden="true" />
      <span className="kr-cloud kr-cloud-2" aria-hidden="true" />
      <span className="kr-cloud kr-cloud-3" aria-hidden="true" />
      <span className="kr-hills" aria-hidden="true" />
      <span className="kr-road" aria-hidden="true"><span className="kr-lane" /></span>
      <div className="kr-splash-stage">
        <div className="kr-splash">
          <div className="kr-splash-smoke" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 0.11}s` }} />)}
          </div>
          <BrandLockup size={120} />
        </div>
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
