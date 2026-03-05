import React, { createContext, useContext, useState } from 'react';
import { Ride, RideStatus } from '../types';

interface RideContextType {
  activeRide: Ride | null;
  requestRide: (ride: Ride) => void;
  updateRideStatus: (status: RideStatus) => void;
  cancelRide: () => void;
}

const RideContext = createContext<RideContextType | undefined>(undefined);

export const RideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  const requestRide = (ride: Ride) => {
    setActiveRide(ride);
  };

  const updateRideStatus = (status: RideStatus) => {
    if (activeRide) {
        setActiveRide(prev => prev ? ({ ...prev, status }) : null);
    }
  };

  const cancelRide = () => {
    setActiveRide(null);
  };

  return (
    <RideContext.Provider value={{ activeRide, requestRide, updateRideStatus, cancelRide }}>
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