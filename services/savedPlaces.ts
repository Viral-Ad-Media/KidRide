import { useEffect, useState } from 'react';
import { apiRequest, getStoredToken } from './api';
import { PlaceCoords } from '../types';

// A parent's saved places (Home, School, Piano lesson). One shared copy keeps
// the booking flow and Profile in step without reloading.

export type PlaceKind = 'home' | 'school' | 'activity' | 'other';
export interface SavedPlace { id: string; label: string; address: string; kind: PlaceKind; coords: PlaceCoords }
export interface PlaceInput { label: string; address: string; kind: PlaceKind; coords: PlaceCoords }

const PATH = '/users/me/places';
type ListResult = { places: SavedPlace[]; unavailable?: boolean };

let cache: SavedPlace[] | null = null;
let unavailable = false;
let pending: Promise<SavedPlace[]> | null = null;
const listeners = new Set<() => void>();
const publish = (places: SavedPlace[]) => { cache = places; listeners.forEach((listener) => listener()); return places; };

export const loadSavedPlaces = (force = false): Promise<SavedPlace[]> => {
  if (cache && !force) return Promise.resolve(cache);
  if (!pending) {
    pending = apiRequest<ListResult>(PATH, { token: getStoredToken() })
      .then((result) => { unavailable = !!result.unavailable; return publish(result.places || []); })
      .finally(() => { pending = null; });
  }
  return pending;
};

export const addSavedPlace = async (place: PlaceInput) =>
  publish((await apiRequest<ListResult>(PATH, { method: 'POST', token: getStoredToken(), body: { ...place } })).places);

export const updateSavedPlace = async (id: string, place: PlaceInput) =>
  publish((await apiRequest<ListResult>(`${PATH}/${encodeURIComponent(id)}`, { method: 'PUT', token: getStoredToken(), body: { ...place } })).places);

export const removeSavedPlace = async (id: string) =>
  publish((await apiRequest<ListResult>(`${PATH}/${encodeURIComponent(id)}`, { method: 'DELETE', token: getStoredToken() })).places);

/** Forget the list when someone signs out, so the next account starts clean. */
export const clearSavedPlaces = () => { cache = null; unavailable = false; };

export const useSavedPlaces = () => {
  const [places, setPlaces] = useState<SavedPlace[]>(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setPlaces(cache || []);
    listeners.add(update);
    loadSavedPlaces()
      .then(update)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load your saved places.'))
      .finally(() => setLoading(false));
    return () => { listeners.delete(update); };
  }, []);
  return { places, loading, error, unavailable };
};

/** The saved place at this address, if any (addresses picked from Google match exactly). */
export const placeAt = (places: SavedPlace[], address: string, coords: PlaceCoords | null) => {
  const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return places.find((place) => norm(place.address) === norm(address)
    && (!coords || (Math.abs(place.coords.lat - coords.lat) < 0.0005 && Math.abs(place.coords.lng - coords.lng) < 0.0005))) || null;
};

/** A name suggestion for a new place, based on what the parent already has. */
export const suggestLabel = (places: SavedPlace[]) => {
  const has = (kind: PlaceKind) => places.some((place) => place.kind === kind);
  return !has('home') ? 'Home' : !has('school') ? 'School' : '';
};

export const guessKind = (label: string): PlaceKind => {
  const name = label.toLowerCase();
  if (/\b(home|house|mum|mom|dad|grandma|granny|nan|grandpa)\b/.test(name)) return 'home';
  if (/\b(school|academy|college|nursery|daycare|kindergarten|preschool)\b/.test(name)) return 'school';
  if (/\b(lesson|class|club|practice|training|piano|swim|football|soccer|dance|music|gym|tutor|ballet|karate)\b/.test(name)) return 'activity';
  return 'other';
};
