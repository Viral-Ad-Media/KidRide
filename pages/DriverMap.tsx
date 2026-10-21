import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DriverIdleMap } from '../components/DriverIdleMap';
import { LiveMap } from '../components/LiveMap';
import { StatusChip } from '../components/UIComponents';
import { useRide } from '../contexts/RideContext';
import { RideStatus } from '../types';

// The driver's Map tab: the current trip's route and car when there is one,
// otherwise their own position with the rides waiting nearby.

export const DriverMap = () => {
  const navigate = useNavigate();
  const { activeRide, acceptRide } = useRide();
  const onTrip = !!activeRide && ![RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER, RideStatus.COMPLETED, RideStatus.CANCELLED].includes(activeRide.status);

  return (
    <div className="relative h-[calc(100dvh-56px-64px-1.25rem)] overflow-hidden rounded-card border border-line lg:h-[calc(100dvh-7.5rem)]">
      {onTrip && activeRide ? (
        <>
          <LiveMap
            pickup={activeRide.pickupLocation}
            dropoff={activeRide.dropoffLocation}
            pickupCoords={activeRide.pickupCoords}
            dropoffCoords={activeRide.dropoffCoords}
            driverLocation={activeRide.driverLocation}
            nextStop={activeRide.status === RideStatus.IN_PROGRESS ? 'dropoff' : 'pickup'}
            className="h-full rounded-none"
            controlsClassName="right-3 top-3"
            noticeClassName="left-3 right-16 top-3"
          />
          <button type="button" onClick={() => navigate('/driver-dashboard')} className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-card bg-white px-4 py-3 text-left shadow-float sm:left-auto sm:w-[360px]">
            <StatusChip status={activeRide.status} />
            <span className="min-w-0 flex-1 truncate text-label font-semibold">{activeRide.status === RideStatus.IN_PROGRESS ? activeRide.dropoffLocation : activeRide.pickupLocation}</span>
            <ArrowRight size={18} className="text-muted" />
          </button>
        </>
      ) : (
        <DriverIdleMap onAccept={acceptRide} fill />
      )}
    </div>
  );
};
