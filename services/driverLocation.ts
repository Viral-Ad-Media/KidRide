import { useEffect, useState } from 'react';
import { apiRequest, getStoredToken } from './api';
import { isLocationSupported, watchSharedPosition } from './sharedPosition';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
// Every few seconds while a trip is active, so the parent sees the car move;
// the parent's map glides the marker between these updates.
const SEND_INTERVAL_MS = 4000;
// Browsers report heading/speed as null (or NaN when not moving).
const validNumber = (value: number | null, max: number) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null);

export const useDriverLocation = () => {
  const { user } = useAuth();
  const { activeRide } = useRide();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.isVerifiedDriver || user.driverApplicationStatus !== 'approved' || !activeRide || !['driver_assigned', 'driver_arrived_at_pickup', 'child_picked_up'].includes(activeRide.status)) return;
    if (!isLocationSupported()) { setError('GPS is unavailable in this browser.'); return; }
    let disposed = false;
    let sending = false;
    let lastSent = 0;
    const unwatch = watchSharedPosition(async position => {
      if (disposed || sending || document.hidden || Date.now() - lastSent < SEND_INTERVAL_MS) return;
      sending = true;
      lastSent = Date.now();
      try {
        await apiRequest(`/rides/${activeRide.id}/location`, { method: 'PUT', token: getStoredToken(), body: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, heading: validNumber(position.coords.heading, 360), speed: validNumber(position.coords.speed, 150) } });
        if (!disposed) setError(null);
      } catch { if (!disposed) setError('Location sharing interrupted. Check your connection and keep this page open.'); }
      finally { sending = false; }
    }, (geoError) => { if (!disposed && geoError.code === geoError.PERMISSION_DENIED) setError('Enable location access to share your trip GPS.'); });
    return () => { disposed = true; unwatch(); };
  }, [user?.id, user?.isVerifiedDriver, user?.driverApplicationStatus, activeRide?.id, activeRide?.status]);
  return error;
};
