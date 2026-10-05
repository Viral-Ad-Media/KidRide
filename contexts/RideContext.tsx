import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Ride, RideStatus, UserRole } from '../types';
import { useAuth } from './AuthContext';
import { apiRequest, getStoredToken, mapRide } from '../services/api';

interface RideContextType {
  activeRide: Ride | null;
  syncError: string | null;
  requestRide: (ride: Ride) => Promise<void>;
  updateRideStatus: (status: RideStatus) => Promise<void>;
  declineRideRequest: () => Promise<void>;
  cancelRide: () => Promise<void>;
  refreshActiveRide: () => Promise<void>;
}
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

  const refreshActiveRide = async () => {
    if (!user || isHydrating || busy.current || refreshing.current) return;
    const session = generation.current;
    const version = ++requestVersion.current;
    refreshing.current = true;
    try {
      const token = await getStoredToken();
      if (!token) return;
      let raw = await apiRequest<unknown | null>('/rides/active', { token });
      if (!raw && approved) {
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
    const interval = setInterval(() => void refreshActiveRide(), 7000);
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
      if (session === generation.current) { setActiveRide(clear ? null : mapRide(raw)); setSyncError(null); }
    } finally { if (session === generation.current) busy.current = false; }
  };
  const requestRide = (ride: Ride) => mutate('/rides/request', { childId: ride.childId, pickup: ride.pickupLocation, dropoff: ride.dropoffLocation, pickupTime: ride.pickupTime, serviceType: ride.serviceType, quotedPrice: ride.price });
  const updateRideStatus = async (status: RideStatus) => {
    if (!activeRide) throw new Error('No active trip.');
    const accepting = status === RideStatus.DRIVER_ASSIGNED && [RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER].includes(activeRide.status);
    await mutate(`/rides/${activeRide.id}/${accepting ? 'accept' : 'status'}`, accepting ? undefined : { status });
  };
  const cancelRide = async () => { if (!activeRide) throw new Error('No active trip.'); await mutate(`/rides/${activeRide.id}/cancel`, undefined, true); };
  const declineRideRequest = async () => {
    if (!activeRide) throw new Error('No open trip.');
    await mutate(`/rides/${activeRide.id}/decline`, undefined, true);
    await refreshActiveRide();
  };
  return <RideContext.Provider value={{ activeRide, syncError, requestRide, updateRideStatus, cancelRide, declineRideRequest, refreshActiveRide }}>{children}</RideContext.Provider>;
};
export const useRide = () => {
  const context = useContext(RideContext);
  if (!context) throw new Error('useRide must be used within RideProvider');
  return context;
};
