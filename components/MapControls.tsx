/// <reference types="google.maps" />
import React from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';

// KidRide's own zoom and recenter buttons (Google's default controls are off).

interface MapControlsProps {
  map: React.MutableRefObject<google.maps.Map | null>;
  onRecenter?: () => void;
  recenterLabel?: string;
  className?: string;
}

const buttonClass = 'inline-flex h-10 w-10 items-center justify-center text-ink transition hover:bg-surface hover:text-brand-deep active:scale-95';

export const MapControls: React.FC<MapControlsProps> = ({ map, onRecenter, recenterLabel = 'Recenter map', className = 'right-3 top-3' }) => {
  const zoomBy = (delta: number) => { const current = map.current; if (current) current.setZoom((current.getZoom() ?? 13) + delta); };
  return (
    <div className={`absolute z-10 flex flex-col gap-2 ${className}`}>
      {onRecenter && (
        <button type="button" onClick={onRecenter} aria-label={recenterLabel} title={recenterLabel} className={`${buttonClass} rounded-control border border-line bg-white`}>
          <Crosshair size={18} />
        </button>
      )}
      <div className="flex flex-col overflow-hidden rounded-control border border-line bg-white">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in" className={buttonClass}><Plus size={18} /></button>
        <span className="mx-2 h-px bg-line" />
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out" className={buttonClass}><Minus size={18} /></button>
      </div>
    </div>
  );
};
