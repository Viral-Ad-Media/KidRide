import { useEffect, useState } from 'react';
import { apiRequest, getStoredToken } from './api';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
export const useDriverLocation = () => {
  const { user } = useAuth();
  const { activeRide } = useRide();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.isVerifiedDriver || user.driverApplicationStatus !== 'approved' || !activeRide || !['driver_assigned', 'driver_arrived_at_pickup', 'child_picked_up'].includes(activeRide.status)) return;
    if (!navigator.geolocation) { setError('GPS is unavailable in this browser.'); return; }
    let disposed = false;
    let sending = false;
    let lastSent = 0;
    const id = navigator.geolocation.watchPosition(async position => {
      if (disposed || sending || document.hidden || Date.now() - lastSent < 10000) return;
      sending = true;
      lastSent = Date.now();
      try {
        await apiRequest(`/rides/${activeRide.id}/location`, { method: 'PUT', token: getStoredToken(), body: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } });
        if (!disposed) setError(null);
      } catch { if (!disposed) setError('Location sharing interrupted. Check your connection and keep this page open.'); }
      finally { sending = false; }
    }, () => { if (!disposed) setError('Enable location access to share your trip GPS.'); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
    return () => { disposed = true; navigator.geolocation.clearWatch(id); };
  }, [user?.id, user?.isVerifiedDriver, user?.driverApplicationStatus, activeRide?.id, activeRide?.status]);
  return error;
};
