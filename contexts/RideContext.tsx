import React, { createContext, useContext, useEffect, useState } from 'react';
import { Ride, RideStatus, UserRole } from '../types';
import { useAuth } from './AuthContext';
import { apiRequest, getStoredToken, mapRide } from '../services/api';

interface RideContextType {
  activeRide: Ride | null;
  requestRide: (ride: Ride) => Promise<void>;
  updateRideStatus: (status: RideStatus) => Promise<void>;
  declineRideRequest: () => Promise<void>;
  cancelRide: () => Promise<void>;
  refreshActiveRide: () => Promise<void>;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export const RideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const { user } = useAuth();

  const refreshActiveRide = async () => {
    if (!user) {
      setActiveRide(null);
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setActiveRide(null);
      return;
    }

    const active = await apiRequest<unknown | null>('/rides/active', { token });
    if (active) {
      setActiveRide(mapRide(active));
      return;
    }

    if (user.role === UserRole.DRIVER) {
      const openRides = await apiRequest<unknown[]>('/rides/open?limit=1', { token });
      if (Array.isArray(openRides) && openRides.length > 0) {
        setActiveRide(mapRide(openRides[0]));
        return;
      }
    }

    setActiveRide(null);
  };

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    const sync = async () => {
      try {
        await refreshActiveRide();
      } catch {
        if (isMounted) {
          setActiveRide(null);
        }
      }
    };

    void sync();

    if (user) {
      intervalId = window.setInterval(() => {
        void sync();
      }, 7000);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [user?.id, user?.role]);

  const requestRide = async (ride: Ride) => {
    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to request a ride.');
    }

    const parsedPickupTime = ride.pickupTime ? Date.parse(ride.pickupTime) : NaN;
    const pickupTime = Number.isNaN(parsedPickupTime)
      ? undefined
      : new Date(parsedPickupTime).toISOString();

    const createdRide = await apiRequest<unknown>('/rides/request', {
      method: 'POST',
      token,
      body: {
        childId: ride.childId,
        pickup: ride.pickupLocation,
        dropoff: ride.dropoffLocation,
        pickupTime,
        price: ride.price,
        serviceType: ride.serviceType
      }
    });

    setActiveRide(mapRide(createdRide));
  };

  const updateRideStatus = async (status: RideStatus) => {
    if (!activeRide) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to update ride status.');
    }

    const acceptingRide =
      status === RideStatus.DRIVER_ASSIGNED &&
      (activeRide.status === RideStatus.SEARCHING_DRIVER || activeRide.status === RideStatus.REQUESTED);

    const updatedRide = acceptingRide
      ? await apiRequest<unknown>(`/rides/${activeRide.id}/accept`, {
          method: 'PUT',
          token
        })
      : await apiRequest<unknown>(`/rides/${activeRide.id}/status`, {
          method: 'PUT',
          token,
          body: { status }
        });

    setActiveRide(mapRide(updatedRide));
  };

  const cancelRide = async () => {
    if (!activeRide) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to cancel a ride.');
    }

    await apiRequest(`/rides/${activeRide.id}/cancel`, {
      method: 'PUT',
      token
    });

    setActiveRide(null);
  };

  const declineRideRequest = async () => {
    if (!activeRide) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to decline a ride request.');
    }

    const decliningOpenRide =
      activeRide.status === RideStatus.SEARCHING_DRIVER ||
      activeRide.status === RideStatus.REQUESTED;

    if (!decliningOpenRide) {
      throw new Error('Only open ride requests can be declined.');
    }

    await apiRequest(`/rides/${activeRide.id}/decline`, {
      method: 'PUT',
      token
    });

    setActiveRide(null);
    await refreshActiveRide();
  };

  return (
    <RideContext.Provider value={{ activeRide, requestRide, updateRideStatus, declineRideRequest, cancelRide, refreshActiveRide }}>
      {children}
    </RideContext.Provider>
  );
};

export const useRide = () => {
  const context = useContext(RideContext);
  if (context === undefined) {
    throw new Error('useRide must be used within an RideProvider');
  }
  return context;
};
