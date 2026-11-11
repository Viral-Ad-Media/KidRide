import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Ride, RideStatus, UserRole } from '../types';
import { useAuth } from './AuthContext';
import { ApiError, apiRequest, getStoredToken, mapRide } from '../services/api';
import { watchSharedPosition } from '../services/sharedPosition';

// A random id for this phone or browser, so going online from a new device can ask for a face check.
const DEVICE_KEY = 'kidride_device_id';
const readDeviceId = () => {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return undefined; }
};

interface RideContextType {
  activeRide: Ride | null;
  syncError: string | null;
  requestRide: (ride: Ride) => Promise<void>;
  /** Moving to IN_PROGRESS (child in the car) needs the trip code the parent gives the driver. */
  updateRideStatus: (status: RideStatus, tripCode?: string) => Promise<void>;
  /** Driver: the child did not come out after the wait window. */
  markNoShow: () => Promise<void>;
  declineRideRequest: () => Promise<void>;
  /** Driver accepts a specific waiting ride (e.g. one picked on the map). */
  acceptRide: (rideId: string) => Promise<void>;
  cancelRide: () => Promise<void>;
  refreshActiveRide: () => Promise<void>;
  /** Driver availability; offers are only fetched while online. Remembered per browser. */
  isOnline: boolean;
  /** The server refused Online: the driver has verification checks to finish. */
  verificationRequired: boolean;
  /** The server has confirmed this driver is online (false while connecting or after a failure). */
  onlineConfirmed: boolean;
  /** Why the driver was put back offline, when it was not their choice. */
  presenceNotice: string | null;
  setIsOnline: (online: boolean) => void;
}
const ONLINE_STORAGE_KEY = 'kidride_driver_online';
// Online drivers report their position this often (for nearest-driver offers).
const PRESENCE_INTERVAL_MS = 10000;
// Drivers poll faster than parents: an offer is only theirs for 20 seconds.
const DRIVER_POLL_MS = 4000;
const PARENT_POLL_MS = 7000;
// Matches the API: a ride booked for later becomes the current trip 15 minutes before pickup.
const CURRENT_LEAD_MS = 15 * 60 * 1000;
const isLaterRide = (ride: Ride) => !!ride.isScheduled
  && [RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER, RideStatus.DRIVER_ASSIGNED].includes(ride.status)
  && new Date(ride.pickupTime).getTime() - Date.now() > CURRENT_LEAD_MS;
const readOnline = () => { try { return window.localStorage.getItem(ONLINE_STORAGE_KEY) !== 'false'; } catch { return true; } };
const RideContext = createContext<RideContextType | undefined>(undefined);
export const RideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { user, isHydrating } = useAuth();
  const generation = useRef(0);
  const requestVersion = useRef(0);
  const busy = useRef(false);
  const refreshing = useRef(false);
  const approved = user?.role === UserRole.DRIVER && user.isVerifiedDriver && user.driverApplicationStatus === 'approved';
  const [isOnline, setIsOnlineState] = useState(readOnline);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [onlineConfirmed, setOnlineConfirmed] = useState(false);
  const [presenceNotice, setPresenceNotice] = useState<string | null>(null);
  const online = useRef(isOnline);

  const refreshActiveRide = async () => {
    if (!user || isHydrating || busy.current || refreshing.current) return;
    const session = generation.current;
    const version = ++requestVersion.current;
    refreshing.current = true;
    try {
      const token = await getStoredToken();
      if (!token) return;
      let raw = await apiRequest<unknown | null>('/rides/active', { token });
      if (!raw && approved && online.current) {
        const offers = await apiRequest<unknown[]>('/rides/open?limit=1', { token });
        raw = offers[0] || null;
      }
      if (session === generation.current && version === requestVersion.current) {
        setActiveRide(raw ? mapRide(raw) : null);
        setSyncError(null);
      }
    } catch {
      if (session === generation.current && version === requestVersion.current) setSyncError('Connection interrupted. Showing the last saved trip; updates may be delayed.');
    } finally { if (session === generation.current) refreshing.current = false; }
  };
  useEffect(() => {
    generation.current += 1;
    requestVersion.current += 1;
    refreshing.current = false;
    busy.current = false;
    setActiveRide(null);
    setSyncError(null);
    if (!user || isHydrating) return;
    void refreshActiveRide();
    // Parents' tabs in the background poll less (every 4th tick); drivers keep polling for offers.
    let tick = 0;
    const interval = setInterval(() => {
      tick += 1;
      if (user?.role !== UserRole.DRIVER && document.hidden && tick % 4 !== 0) return;
      void refreshActiveRide();
    }, user?.role === UserRole.DRIVER ? DRIVER_POLL_MS : PARENT_POLL_MS);
    return () => { generation.current += 1; clearInterval(interval); };
  }, [user?.id, user?.role, user?.isVerifiedDriver, user?.driverApplicationStatus, isHydrating]);

  const mutate = async (path: string, body?: Record<string, unknown>, clear = false) => {
    if (busy.current) throw new Error('A trip update is already in progress.');
    busy.current = true;
    const session = generation.current;
    requestVersion.current += 1;
    try {
      const token = await getStoredToken();
      if (!token || session !== generation.current) throw new Error('Sign in again to update this trip.');
      const raw = await apiRequest<unknown>(path, { method: path === '/rides/request' ? 'POST' : 'PUT', token, body });
      // A ride for later that was just accepted waits in the Upcoming list, not as the current trip.
      const ride = clear ? null : mapRide(raw);
      if (session === generation.current) { setActiveRide(ride && !isLaterRide(ride) ? ride : null); setSyncError(null); }
    } finally { if (session === generation.current) busy.current = false; }
  };
  // Presence heartbeat: tells the server this driver is online and, when the
  // browser shares it, where they are, so nearby rides are offered to them first.
  useEffect(() => {
    if (!approved || !isOnline) return;
    let position: GeolocationPosition | null = null;
    const unwatch = watchSharedPosition((latest) => { position = latest; });
    const beat = () => {
      const token = getStoredToken();
      if (!token) return;
      const heading = position?.coords.heading;
      const deviceId = readDeviceId();
      const body = position
        ? { online: true, deviceId, latitude: position.coords.latitude, longitude: position.coords.longitude, heading: typeof heading === 'number' && Number.isFinite(heading) ? heading : null }
        : { online: true, deviceId };
      void apiRequest('/users/me/presence', { method: 'PUT', token, body }).then(() => { setVerificationRequired(false); setOnlineConfirmed(true); setPresenceNotice(null); }).catch((error) => {
        // Fail closed: the app only says "online" after the server confirms it.
        setOnlineConfirmed(false);
        if (!(error instanceof ApiError) || error.status === 429) return; // no connection or busy: keep trying
        const code = (error.data as { code?: string } | null)?.code;
        // An open verification check keeps the driver offline until it is done.
        if (code === 'verification_required') setVerificationRequired(true);
        else setPresenceNotice(error.message || 'We could not put you online. Try again in a minute.');
        setIsOnlineState(false);
        online.current = false;
        try { window.localStorage.setItem(ONLINE_STORAGE_KEY, 'false'); } catch { /* not persisted */ }
      });
    };
    beat();
    const interval = setInterval(beat, PRESENCE_INTERVAL_MS);
    return () => { clearInterval(interval); unwatch(); };
  }, [approved, isOnline, user?.id]);

  const setIsOnline = (next: boolean) => {
    online.current = next;
    setOnlineConfirmed(false);
    if (next) setPresenceNotice(null);
    setIsOnlineState(next);
    if (!next && approved) {
      const token = getStoredToken();
      if (token) void apiRequest('/users/me/presence', { method: 'PUT', token, body: { online: false } }).catch(() => undefined);
    }
    try { window.localStorage.setItem(ONLINE_STORAGE_KEY, String(next)); } catch { /* not persisted */ }
    if (next) void refreshActiveRide();
    // Going offline drops an unaccepted offer; an accepted trip stays.
    else setActiveRide((ride) => ride && [RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER].includes(ride.status) ? null : ride);
  };
  const requestRide = (ride: Ride) => mutate('/rides/request', { childId: ride.childId, childIds: ride.childIds, pickup: ride.pickupLocation, dropoff: ride.dropoffLocation, pickupTime: ride.pickupTime, serviceType: ride.serviceType, quoteToken: ride.quoteToken, stayMinutes: ride.stayMinutes, pickupCoords: ride.pickupCoords, dropoffCoords: ride.dropoffCoords });
  const updateRideStatus = async (status: RideStatus, tripCode?: string) => {
    if (!activeRide) throw new Error('No active trip.');
    const accepting = status === RideStatus.DRIVER_ASSIGNED && [RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER].includes(activeRide.status);
    await mutate(`/rides/${activeRide.id}/${accepting ? 'accept' : 'status'}`, accepting ? undefined : { status, ...(tripCode ? { tripCode } : {}) });
  };
  const markNoShow = async () => { if (!activeRide) throw new Error('No active trip.'); await mutate(`/rides/${activeRide.id}/no-show`, undefined, true); };
  const acceptRide = (rideId: string) => mutate(`/rides/${rideId}/accept`);
  const cancelRide = async () => { if (!activeRide) throw new Error('No active trip.'); await mutate(`/rides/${activeRide.id}/cancel`, undefined, true); };
  const declineRideRequest = async () => {
    if (!activeRide) throw new Error('No open trip.');
    await mutate(`/rides/${activeRide.id}/decline`, undefined, true);
    await refreshActiveRide();
  };
  return <RideContext.Provider value={{ activeRide, syncError, requestRide, updateRideStatus, markNoShow, cancelRide, declineRideRequest, acceptRide, refreshActiveRide, isOnline, setIsOnline, verificationRequired, onlineConfirmed, presenceNotice }}>{children}</RideContext.Provider>;
};
export const useRide = () => {
  const context = useContext(RideContext);
  if (!context) throw new Error('useRide must be used within RideProvider');
  return context;
};
