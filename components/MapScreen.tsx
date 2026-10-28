import React, { useEffect, useState } from 'react';

// A screen where the map is the background and the content floats on it:
// a bottom sheet on phones (grab handle, 24px top corners, never more than
// about 60% of the screen), a panel beside the map on larger screens. The
// content is rendered once, in whichever of the two fits the viewport.
// Used by the parent home and the booking flow.

interface MapScreenProps {
  map: React.ReactNode;
  children: React.ReactNode;
  /** Something that sits on the map itself (a chip, a recenter button). */
  overlay?: React.ReactNode;
  /** Sheet height on phones; the map shows above it. */
  sheetClassName?: string;
}

export const PANEL_WIDTH = 440;
const DESKTOP = '(min-width: 1024px)'; // Tailwind lg, where the sidebar rail appears

const useDesktop = () => {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const onChange = () => setDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return desktop;
};

export const MapScreen: React.FC<MapScreenProps> = ({ map, children, overlay, sheetClassName = 'max-h-[62%]' }) => {
  const desktop = useDesktop();
  return (
    <div className="relative h-[calc(100dvh-56px-64px)] overflow-hidden lg:flex lg:h-dvh">
      {desktop && (
        <aside className="h-full shrink-0 overflow-y-auto border-r border-line bg-white px-6 py-6" style={{ width: PANEL_WIDTH }}>
          {children}
        </aside>
      )}
      <div className="relative h-full flex-1">
        <div className="absolute inset-0">{map}</div>
        {overlay}
        {!desktop && (
          <div className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-sheet bg-white shadow-[0_-8px_24px_rgba(20,33,61,0.12)] ${sheetClassName}`}>
            <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden="true" />
            <div className="min-h-0 overflow-y-auto px-4 pb-4 pt-3">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
};
