import React, { useState, useEffect } from 'react';
import { RideMap } from '../components/RideMap';
import { Card, Button, StatusChip, Badge } from '../components/UIComponents';
import { ShieldAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRide } from '../contexts/RideContext';
import { RideStatus } from '../types';

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
  const { activeRide } = useRide();
  const [localStatus, setLocalStatus] = useState<RideStatus>(RideStatus.DRIVER_ASSIGNED);

  useEffect(() => {
    if (activeRide) {
      setLocalStatus(activeRide.status);
    }
  }, [activeRide]);

  if (!activeRide) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-100">
        <p className="text-gray-500">No active ride found.</p>
        <Button onClick={() => navigate('/book')}>Book a Ride</Button>
      </div>
    );
  }

  const driver = activeRide.driver;
  const vehicle = formatVehicle(driver?.vehicle);
  const tripCode = activeRide.tripCode || 'Pending';
  const safeWord = activeRide.safeWord || 'Pending';

  return (
    <div className="relative flex h-[calc(100vh-80px)] flex-col bg-gray-100 md:h-[600px]">
      <div className="relative flex-1">
        <button
          onClick={() => navigate('/dashboard')}
          className="absolute left-4 top-4 z-10 rounded-full bg-white p-2 shadow-md"
        >
          <X size={24} />
        </button>
        <RideMap status={localStatus} />
      </div>

      <div className="relative z-10 -mt-6 rounded-t-3xl bg-white p-6 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] animate-slide-up">
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-300" />

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
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-blue-50 text-sm font-semibold text-[#3A77FF] shadow-md">
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

        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-1 shrink-0 text-[#3A77FF]" size={20} />
            <div>
              <p className="text-sm font-bold text-[#3A77FF]">Safety Check</p>
              <p className="mt-1 text-sm text-blue-800">
                Driver must say the safe word:
                <span className="ml-2 rounded border border-blue-200 bg-white px-2 py-0.5 font-bold">{safeWord}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
          Direct driver contact is not configured in this build yet.
        </div>
      </div>
    </div>
  );
};
