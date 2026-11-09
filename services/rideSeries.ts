import { PlaceCoords, Ride, ServiceType } from '../types';
import { apiRequest, getStoredToken, mapRide } from './api';

// Repeating school-week bookings. The parent picks weekdays, a local pickup
// time and a date range; the server books each ride a week ahead and prices
// every ride on its own (peak times can differ by day).

export const WEEKDAYS = [
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
  { day: 0, short: 'Sun', long: 'Sunday' }
];
export const SCHOOL_DAYS = [1, 2, 3, 4, 5];
export const MAX_START_AHEAD_DAYS = 30;
export const MAX_SERIES_DAYS = 200;
const MIN_LEAD_MS = 30 * 60000;

export interface SeriesPlan { weekdays: number[]; pickupLocalTime: string; startDate: string; endDate: string }
export interface SeriesTrip {
  childIds: string[]; pickup: string; dropoff: string; pickupCoords: PlaceCoords | null; dropoffCoords: PlaceCoords | null;
  serviceType: ServiceType; stayMinutes: number;
}
export interface SeriesPreview { currency: string; rideCount: number; rides: { date: string; pickupTime: string; total: number }[] }
export interface RideSeries extends SeriesPlan {
  id: string; childIds: string[]; pickupLocation: string; dropoffLocation: string; serviceType: string; stayMinutes: number;
  timeZone: string; skippedDates: string[]; status: string; nextDays: string[]; rides: Ride[];
}

const pad = (value: number) => String(value).padStart(2, '0');
export const ymd = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseYmd = (value: string) => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (value: string, days: number) => { const date = parseYmd(value); date.setDate(date.getDate() + days); return ymd(date); };
const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Ride days (local) of a plan whose pickup is at least 30 minutes away. */
export const planDays = (plan: SeriesPlan, now = new Date(), limit = 400) => {
  const out: { date: string; pickup: Date }[] = [];
  const today = ymd(now);
  for (let day = plan.startDate > today ? plan.startDate : today; day <= plan.endDate && out.length < limit; day = addDays(day, 1)) {
    if (!plan.weekdays.includes(parseYmd(day).getDay())) continue;
    const [h, m] = plan.pickupLocalTime.split(':').map(Number);
    const pickup = parseYmd(day); pickup.setHours(h, m, 0, 0);
    if (pickup.getTime() >= now.getTime() + MIN_LEAD_MS) out.push({ date: day, pickup });
  }
  return out;
};

export const validatePlan = (plan: SeriesPlan, now = new Date()): string | null => {
  if (!plan.weekdays.length) return 'Choose at least one day.';
  if (!/^\d{2}:\d{2}$/.test(plan.pickupLocalTime)) return 'Choose a pickup time.';
  if (Number(plan.pickupLocalTime.slice(3)) % 5) return 'Choose a time in 5-minute steps.';
  if (!plan.startDate || !plan.endDate) return 'Choose the first and last day.';
  const today = ymd(now);
  if (plan.startDate < today) return 'The first day has passed.';
  if (daysBetween(today, plan.startDate) > MAX_START_AHEAD_DAYS) return `Start within the next ${MAX_START_AHEAD_DAYS} days.`;
  if (plan.endDate < plan.startDate) return 'The last day must be after the first day.';
  if (daysBetween(plan.startDate, plan.endDate) > MAX_SERIES_DAYS) return `Up to ${MAX_SERIES_DAYS} days at a time. Book the next term separately.`;
  if (!planDays(plan, now, 1).length) return 'No ride days fall in those dates.';
  return null;
};

export const formatDay = (value: string) => parseYmd(value).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
export const formatClock = (hhmm: string) => { const d = new Date(); d.setHours(Number(hhmm.slice(0, 2)), Number(hhmm.slice(3)), 0, 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
export const describeDays = (weekdays: number[]) => {
  const sorted = WEEKDAYS.filter((w) => weekdays.includes(w.day));
  if (sorted.length === 5 && SCHOOL_DAYS.every((d) => weekdays.includes(d))) return 'Every school day';
  if (sorted.length === 7) return 'Every day';
  return `Every ${sorted.map((w) => w.short).join(', ')}`;
};

const token = () => {
  const value = getStoredToken();
  if (!value) throw new Error('Sign in again to manage your rides.');
  return value;
};

const body = (trip: SeriesTrip, plan: SeriesPlan) => ({ ...trip, ...plan, timeZone: browserTimeZone() });

export const previewSeries = (trip: SeriesTrip, plan: SeriesPlan) => apiRequest<SeriesPreview>('/ride-series/preview', { method: 'POST', token: token(), body: body(trip, plan) });

const mapSeries = (raw: any): RideSeries => ({ ...raw, rides: Array.isArray(raw.rides) ? raw.rides.map(mapRide) : [] });

export const bookSeries = async (trip: SeriesTrip, plan: SeriesPlan) => mapSeries(await apiRequest<unknown>('/ride-series', { method: 'POST', token: token(), body: body(trip, plan) }));
export const fetchSeries = async () => (await apiRequest<unknown[]>('/ride-series', { token: token() })).map(mapSeries);
export const skipSeriesDay = async (id: string, date: string) => apiRequest<{ cancellationFee: number }>(`/ride-series/${encodeURIComponent(id)}/skip`, { method: 'PUT', token: token(), body: { date } });
export const cancelSeries = async (id: string) => apiRequest<{ cancelledRides: number; cancellationFee: number }>(`/ride-series/${encodeURIComponent(id)}/cancel`, { method: 'PUT', token: token() });
