import { Ride } from '../types';
import { apiRequest, getStoredToken, mapRide } from './api';

// Rides booked for later: 30 minutes to 30 days ahead, in 5-minute steps,
// chosen in the browser's local time and sent to the API in UTC.

export const MIN_LEAD_MINUTES = 30;
export const MAX_AHEAD_DAYS = 30;
export const STEP_MINUTES = 5;

const pad = (value: number) => String(value).padStart(2, '0');

/** Value for <input type="datetime-local"> in local time, e.g. 2026-10-21T16:35. */
export const toLocalInputValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** The first 5-minute slot at least `leadMinutes` from now. */
export const firstSlot = (leadMinutes = MIN_LEAD_MINUTES + STEP_MINUTES, now = new Date()) => {
  const slot = new Date(now.getTime() + leadMinutes * 60000);
  slot.setSeconds(0, 0);
  slot.setMinutes(Math.ceil(slot.getMinutes() / STEP_MINUTES) * STEP_MINUTES);
  return slot;
};

export const latestSlot = (now = new Date()) => {
  const slot = new Date(now.getTime() + MAX_AHEAD_DAYS * 24 * 60 * 60000);
  slot.setSeconds(0, 0);
  slot.setMinutes(Math.floor(slot.getMinutes() / STEP_MINUTES) * STEP_MINUTES);
  return slot;
};

/** Returns an error message for a datetime-local value, or null when it can be booked. */
export const validateScheduleInput = (value: string, now = new Date()): string | null => {
  if (!value) return 'Choose a pickup date and time.';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Choose a valid pickup date and time.';
  if (date.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60000) return 'Rides for later must be at least 30 minutes from now.';
  if (date.getTime() > now.getTime() + MAX_AHEAD_DAYS * 24 * 60 * 60000) return 'Rides can be booked up to 30 days ahead.';
  if (date.getMinutes() % STEP_MINUTES !== 0) return 'Choose a time in 5-minute steps (for example 3:05 or 3:10).';
  return null;
};

export const formatScheduledTime = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time not set';
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
};

export const minutesUntil = (iso: string, now = Date.now()) => Math.round((new Date(iso).getTime() - now) / 60000);

export const scheduleLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  dispatching: 'Finding a driver',
  assigned: 'Driver confirmed',
  needs_attention: 'Needs attention'
};

const token = () => {
  const value = getStoredToken();
  if (!value) throw new Error('Sign in again to manage your rides.');
  return value;
};

export const fetchScheduledRides = async (): Promise<Ride[]> => (await apiRequest<unknown[]>('/rides/scheduled', { token: token() })).map(mapRide);

export const bookScheduledRide = async (ride: Ride): Promise<Ride> => mapRide(await apiRequest<unknown>('/rides/request', {
  method: 'POST',
  token: token(),
  body: {
    childId: ride.childId,
    pickup: ride.pickupLocation,
    dropoff: ride.dropoffLocation,
    pickupTime: ride.pickupTime,
    scheduled: true,
    serviceType: ride.serviceType,
    quotedPrice: ride.price,
    pickupCoords: ride.pickupCoords,
    dropoffCoords: ride.dropoffCoords
  }
}));

export const rescheduleRide = async (id: string, pickupTime: string): Promise<Ride> => mapRide(await apiRequest<unknown>(`/rides/${encodeURIComponent(id)}/schedule`, { method: 'PUT', token: token(), body: { pickupTime } }));

export const cancelScheduledRide = async (id: string): Promise<void> => { await apiRequest(`/rides/${encodeURIComponent(id)}/cancel`, { method: 'PUT', token: token() }); };
