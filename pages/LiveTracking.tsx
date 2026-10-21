import React, { useState, useEffect, useRef } from 'react';
import { LiveMap, RouteInfo } from '../components/LiveMap';
import { Card, Button, ConfirmModal, StatusChip, Badge } from '../components/UIComponents';
import { RatingBadge, useDriverRating } from '../components/Ratings';
import { Car, MapPin, Search, ShieldAlert, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { RideStatus } from '../types';

// Branded card over the map: what is happening now and how long it will take.
const TripStatusCard: React.FC<{
  searching: boolean;
  childOnBoard: boolean;
  arrived: boolean;
  nearbyDrivers?: number | null;
  driverEta?: string;
  tripDuration?: string;
  tripDistance?: string;
}> = ({ searching, childOnBoard, arrived, nearbyDrivers, driverEta, tripDuration, tripDistance }) => {
  const trip = tripDuration ? `${tripDuration}${tripDistance ? ` · ${tripDistance}` : ''} trip` : null;
  const [Icon, title, detail] = searching
    ? [Search, 'Finding a driver near you', typeof nearbyDrivers === 'number'
      ? (nearbyDrivers === 0 ? 'No drivers nearby yet. Open to all drivers.' : `${nearbyDrivers} driver${nearbyDrivers === 1 ? '' : 's'} nearby`)
      : trip]
    : arrived
      ? [MapPin, 'Your driver is at the pickup', trip]
      : childOnBoard
        ? [Car, driverEta ? `Drop-off in ${driverEta}` : 'On the way to drop-off', 'Child on board']
        : [Car, driverEta ? `Driver arriving in ${driverEta}` : 'Driver on the way', trip];
  return (
    <div className="absolute left-16 right-4 top-4 z-10 sm:left-auto sm:w-[320px]" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/95 p-3 pr-4 shadow-[0_16px_36px_rgba(15,23,42,0.18)] backdrop-blur">
        <span className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${searching ? 'bg-amber-50 text-amber-600' : 'bg-brand/10 text-brand-deep'}`}>
          {searching && <span className="absolute inset-0 animate-ping rounded-2xl bg-amber-200/60" />}
          <Icon size={20} className="relative" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">{title}</p>
          {detail && <p className="truncate text-xs text-slate-500">{detail}</p>}
        </div>
      </div>
    </div>
  );
};

const driverInitials = (name: string) => (
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'DR'
);

const formatVehicle = (vehicle?: { color?: string; make?: string; model?: string; plate?: string }) => {
  if (!vehicle) {
    return null;
  }

  const summary = [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  return {
    summary,
    plate: vehicle.plate
  };
};

export const LiveTracking = () => {
  const navigate = useNavigate();
  const { activeRide, syncError, cancelRide, refreshActiveRide } = useRide();
  const { user } = useAuth();
  const [route, setRoute] = useState<RouteInfo>({});

  // Poll faster while the parent is watching the map so the car keeps moving.
  const refresh = useRef(refreshActiveRide);
  refresh.current = refreshActiveRide;
  useEffect(() => {
    const timer = setInterval(() => void refresh.current(), 3000);
    return () => clearInterval(timer);
  }, []);
  const { id } = useParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const driverRating = useDriverRating(activeRide?.driver?.id || activeRide?.driverId);
  const [cancelling, setCancelling] = useState(false);
  const [localStatus, setLocalStatus] = useState<RideStatus>(RideStatus.DRIVER_ASSIGNED);

  useEffect(() => {
    if (activeRide) {
      setLocalStatus(activeRide.status);
    }
  }, [activeRide]);

  const confirmCancel = async () => {
    setCancelling(true);
    try { await cancelRide(); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not cancel the ride.'); }
    finally { setCancelling(false); setConfirmingCancel(false); }
  };

  if (!activeRide || activeRide.id !== id) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-100">
        <p className="text-gray-500">No active ride found.</p>
        <Button onClick={() => navigate('/book')}>Book a Ride</Button>
      </div>
    );
  }

  const driver = activeRide.driver;
  const childName = user?.children?.find((child) => child.id === activeRide.childId)?.name.split(' ')[0];
  const vehicle = formatVehicle(driver?.vehicle);
  const tripCode = activeRide.tripCode || 'Pending';
  const safeWord = activeRide.safeWord || 'Pending';

  return (
    <div className="relative flex flex-col bg-gray-100">
      {/* Map keeps a real height on every screen; the details sheet sits below it. */}
      <div className="relative h-[45vh] min-h-[300px] md:h-[460px]">
        <button
          onClick={() => navigate('/dashboard')}
          className="absolute left-4 top-4 z-10 rounded-full bg-white p-2 shadow-md"
        >
          <X size={24} />
        </button>
        <LiveMap
          pickup={activeRide.pickupLocation}
          dropoff={activeRide.dropoffLocation}
          pickupCoords={activeRide.pickupCoords}
          dropoffCoords={activeRide.dropoffCoords}
          driverLocation={activeRide.driverLocation}
          nextStop={activeRide.status === RideStatus.IN_PROGRESS ? 'dropoff' : 'pickup'}
          pickupLabel={childName ? `Pickup · ${childName}` : 'Pickup'}
          onRoute={setRoute}
          className="h-full rounded-none"
        />
        <TripStatusCard
          searching={[RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER].includes(activeRide.status)}
          childOnBoard={activeRide.status === RideStatus.IN_PROGRESS}
          arrived={activeRide.status === RideStatus.DRIVER_ARRIVED}
          nearbyDrivers={activeRide.nearbyDrivers}
          driverEta={activeRide.driverLocation ? route.driverEta : undefined}
          tripDuration={route.tripDuration}
          tripDistance={route.tripDistance}
        />
      </div>

      <div className="relative z-10 -mt-6 rounded-t-3xl bg-white p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] animate-slide-up">
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-300" />

        {(syncError || actionError) && <p className="mb-4 text-amber-900">{actionError || syncError}</p>}
        <div className="mb-6 flex items-center justify-between">
          <StatusChip status={localStatus} />
          <div className="text-right">
            <p className="text-xs text-gray-500">Trip Code</p>
            <p className="font-mono text-xl font-bold tracking-widest text-gray-900">{tripCode}</p>
          </div>
        </div>

        {driver ? (
          <Card className="mb-6 border border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-4">
              <div className="relative">
                {driver.photoUrl ? (
                  <img src={driver.photoUrl} alt={driver.name} className="h-16 w-16 rounded-full border-2 border-white object-cover shadow-md" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-brand/10 text-sm font-semibold text-brand-deep shadow-md">
                    {driverInitials(driver.name)}
                  </div>
                )}
                {driver.isVerifiedDriver && (
                  <div className="absolute -bottom-1 -right-1 rounded-lg bg-white p-0.5">
                    <Badge type="verified" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold">{driver.name}</h3>
                <RatingBadge summary={driverRating} className="mt-0.5" />
                {vehicle?.summary && <p className="text-sm text-gray-500">{vehicle.summary}</p>}
                {vehicle?.plate && (
                  <div className="mt-2 inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold">
                    {vehicle.plate}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <div className="mb-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            Driver details will appear here once a driver accepts the trip.
          </div>
        )}

        <div className="mb-6 rounded-xl border border-brand/30 bg-brand/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 shrink-0 text-brand-deep" size={20} />
            <div>
              <p className="text-sm font-bold text-brand-deep">Safety Check</p>
              <p className="mt-1 text-sm text-brand-deep">
                Driver must say the safe word:
                <span className="ml-2 rounded border border-brand/30 bg-white px-2 py-0.5 font-bold">{safeWord}</span>
              </p>
            </div>
          </div>
        </div>

        {activeRide.status !== RideStatus.IN_PROGRESS && ![RideStatus.COMPLETED, RideStatus.CANCELLED].includes(activeRide.status) && <Button onClick={() => setConfirmingCancel(true)}>Cancel Ride</Button>}
        <ConfirmModal open={confirmingCancel} title="Cancel this ride?" body="The trip will be cancelled for both the parent and the driver." confirmLabel="Cancel ride" tone="danger" busy={cancelling} onConfirm={() => void confirmCancel()} onClose={() => setConfirmingCancel(false)} />
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          Direct driver contact is not configured in this build yet.
        </div>
      </div>
    </div>
  );
};
