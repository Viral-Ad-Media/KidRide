/// <reference types="google.maps" />
import { useEffect, useState } from 'react';

// One Google Maps loader for the whole app (Maps JavaScript API + Places).
// The key comes from VITE_GOOGLE_MAPS_KEY; without it maps show a notice instead.

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_KEY = viteEnv?.VITE_GOOGLE_MAPS_KEY?.trim() || '';

export type MapsState =
  | { status: 'loading' }
  | { status: 'ready'; maps: typeof google.maps }
  | { status: 'unavailable'; reason: string };

let loadPromise: Promise<typeof google.maps> | null = null;
let authFailure: string | null = null;
const authListeners = new Set<(reason: string) => void>();

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __kidrideMapsReady?: () => void;
  }
}

const loadGoogleMaps = (): Promise<typeof google.maps> => {
  if (!API_KEY) return Promise.reject(new Error('Maps are not set up yet (no Google Maps key).'));
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    // Google calls this when the key is invalid, restricted or has no billing.
    window.gm_authFailure = () => {
      authFailure = 'Google Maps rejected the API key. Check the key, its allowed websites and billing in Google Cloud.';
      authListeners.forEach((listener) => listener(authFailure as string));
    };
    window.__kidrideMapsReady = () => resolve(window.google.maps);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&libraries=places,geometry&v=weekly&loading=async&callback=__kidrideMapsReady`;
    script.async = true;
    script.onerror = () => { loadPromise = null; reject(new Error('Could not load Google Maps. Check your connection.')); };
    document.head.appendChild(script);
  });
  return loadPromise;
};

/** Loads Google Maps once; reports 'unavailable' (with a reason) instead of throwing. */
export const useGoogleMaps = (): MapsState => {
  const [state, setState] = useState<MapsState>(() => (authFailure ? { status: 'unavailable', reason: authFailure } : { status: 'loading' }));
  useEffect(() => {
    let active = true;
    const onAuthFailure = (reason: string) => { if (active) setState({ status: 'unavailable', reason }); };
    authListeners.add(onAuthFailure);
    loadGoogleMaps()
      .then((maps) => { if (active && !authFailure) setState({ status: 'ready', maps }); })
      .catch((error: Error) => { if (active) setState({ status: 'unavailable', reason: error.message }); });
    return () => { active = false; authListeners.delete(onAuthFailure); };
  }, []);
  return state;
};

export interface LatLng {
  lat: number;
  lng: number;
}
