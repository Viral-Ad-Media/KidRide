// One device location watch shared by everything on the driver's screen
// (presence heartbeat, trip GPS, idle map). Several separate watches can
// starve each other in some browsers, and a new watch may take a while to
// report; subscribers here get the last known fix straight away.

type FixListener = (position: GeolocationPosition) => void;
type ErrorListener = (error: GeolocationPositionError) => void;

let watchId: number | null = null;
let lastFix: GeolocationPosition | null = null;
let lastError: GeolocationPositionError | null = null;
const listeners = new Set<{ onFix: FixListener; onError?: ErrorListener }>();

export const isLocationSupported = () => typeof navigator !== 'undefined' && !!navigator.geolocation;

export const getLastPosition = () => lastFix;

/** Subscribes to position updates; returns the unsubscribe function. */
export const watchSharedPosition = (onFix: FixListener, onError?: ErrorListener) => {
  if (!isLocationSupported()) return () => undefined;
  const listener = { onFix, onError };
  listeners.add(listener);
  if (lastFix) onFix(lastFix);
  else if (lastError) onError?.(lastError);
  if (watchId === null) {
    watchId = navigator.geolocation.watchPosition(
      (position) => { lastFix = position; lastError = null; listeners.forEach((l) => l.onFix(position)); },
      (error) => { lastError = error; listeners.forEach((l) => l.onError?.(error)); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      lastError = null;
    }
  };
};
