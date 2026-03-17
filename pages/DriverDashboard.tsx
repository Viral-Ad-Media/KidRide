import React, { useState } from 'react';
import { CheckCircle, DollarSign, MapPin, MessageSquare, Navigation, Phone, ShieldCheck, TimerReset } from 'lucide-react';
import { Button, Card, StatusChip } from '../components/UIComponents';
import { useRide } from '../contexts/RideContext';
import { RideStatus } from '../types';

export const DriverDashboard = () => {
  const { activeRide, updateRideStatus, declineRideRequest } = useRide();
  const [isOnline, setIsOnline] = useState(true);
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStatusUpdate = async (nextStatus: RideStatus) => {
    try {
      setError(null);
      await updateRideStatus(nextStatus);
    } catch (statusError) {
      console.error('Unable to update ride status:', statusError);
      setError('Unable to update ride status right now.');
    }
  };

  const handleDecline = async () => {
    try {
      setError(null);
      setIsDeclining(true);
      await declineRideRequest();
    } catch (declineError) {
      console.error('Unable to decline ride request:', declineError);
      setError('Unable to decline this request right now.');
    } finally {
      setIsDeclining(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[34px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_48%,#1d4ed8_100%)] p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/88">Driver Workspace</p>
            <h2 className="mt-3 text-4xl font-bold text-balance sm:text-5xl">Stay ready for the next family pickup.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/72 sm:text-base">
              Review open jobs, manage live ride status, and keep your driver state clear across mobile and desktop.
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur-xl sm:min-w-[320px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Availability</p>
                <p className="mt-1 text-xs text-white/60">{isOnline ? 'You are visible to nearby ride requests.' : 'Go online to receive new requests.'}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isOnline} onChange={() => setIsOnline(!isOnline)} className="sr-only peer" />
                <div className="h-7 w-12 rounded-full bg-white/25 transition peer-checked:bg-sky-300/70 peer-checked:after:translate-x-5 after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all" />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-white/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Today</p>
                <p className="mt-3 text-2xl font-bold text-white">$84.50</p>
              </div>
              <div className="rounded-[22px] bg-white/10 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Trips</p>
                <p className="mt-3 text-2xl font-bold text-white">5</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-red-100 bg-red-50 px-4 py-4 text-sm text-red-600 shadow-[0_14px_30px_rgba(239,68,68,0.08)]">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
        <div>
          {!isOnline ? (
            <Card className="text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-100 text-slate-500">
                <TimerReset size={28} />
              </div>
              <h3 className="mt-5 text-2xl font-bold text-slate-950">Go online to receive trip requests</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                Your workspace stays available on desktop, but new ride offers only appear when you set yourself to online.
              </p>
            </Card>
          ) : !activeRide ? (
            <Card className="text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-blue-50 text-[#1d6fff]">
                <MapPin size={28} />
              </div>
              <h3 className="mt-5 text-2xl font-bold text-slate-950">Scanning the area</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                When a new request matches your area, it will appear here with pickup details, service type, and quick accept or decline actions.
              </p>
            </Card>
          ) : activeRide.status === RideStatus.SEARCHING_DRIVER || activeRide.status === RideStatus.REQUESTED ? (
            <Card className="overflow-hidden border-[#bfdbfe] bg-[linear-gradient(145deg,#f8fbff_0%,#ffffff_54%,#eff6ff_100%)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1d6fff]">
                    <ShieldCheck size={14} />
                    New Request
                  </div>
                  <h3 className="mt-4 text-3xl font-bold text-slate-950">${activeRide.price.toFixed(2)}</h3>
                  <p className="mt-2 text-sm text-slate-500">Estimated earnings for this ride</p>
                  <div className="mt-5 inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    {activeRide.serviceType.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pickup ETA</p>
                  <p className="mt-3 text-2xl font-bold text-slate-950">2 min</p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 rounded-[28px] bg-slate-50/90 p-5 lg:grid-cols-[auto,1fr]">
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className="h-3 w-3 rounded-full bg-slate-300" />
                  <div className="h-12 w-0.5 bg-slate-200" />
                  <div className="h-3 w-3 rounded-full bg-[#1d6fff]" />
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pickup</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{activeRide.pickupLocation}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Drop-off</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{activeRide.dropoffLocation}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <Button variant="secondary" onClick={() => void handleDecline()} disabled={isDeclining}>
                  {isDeclining ? 'Declining...' : 'Decline'}
                </Button>
                <Button onClick={() => handleStatusUpdate(RideStatus.DRIVER_ASSIGNED)} disabled={isDeclining}>
                  Accept Ride
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#f8fbff_100%)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <StatusChip status={activeRide.status} />
                  <h3 className="mt-4 text-3xl font-bold text-slate-950">Active trip in progress</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    Move the ride through each status as the pickup and drop-off happen.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-500 transition hover:bg-slate-200">
                    <Phone size={18} />
                  </button>
                  <button className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-500 transition hover:bg-slate-200">
                    <MessageSquare size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[26px] bg-slate-950 p-5 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Trip Code</p>
                  <p className="mt-3 text-3xl font-bold">{activeRide.tripCode}</p>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Safe Word</p>
                  <p className="mt-3 text-2xl font-bold text-sky-200">"{activeRide.safeWord}"</p>
                </div>

                <div className="rounded-[26px] bg-slate-50/90 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Trip Route</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{activeRide.pickupLocation}</p>
                  <div className="my-4 h-px bg-slate-200" />
                  <p className="text-lg font-semibold text-slate-950">{activeRide.dropoffLocation}</p>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                {activeRide.status === RideStatus.DRIVER_ASSIGNED && (
                  <Button fullWidth onClick={() => handleStatusUpdate(RideStatus.DRIVER_ARRIVED)}>
                    Arrived at Pickup
                  </Button>
                )}
                {activeRide.status === RideStatus.DRIVER_ARRIVED && (
                  <Button fullWidth onClick={() => handleStatusUpdate(RideStatus.IN_PROGRESS)}>
                    Confirm Child Picked Up
                  </Button>
                )}
                {activeRide.status === RideStatus.IN_PROGRESS && (
                  <Button
                    fullWidth
                    onClick={() => handleStatusUpdate(RideStatus.COMPLETED)}
                    className="bg-[linear-gradient(135deg,#059669_0%,#18b37e_100%)] text-white hover:bg-[linear-gradient(135deg,#047857_0%,#119e6e_100%)]"
                  >
                    Complete Ride
                  </Button>
                )}
                {activeRide.status === RideStatus.COMPLETED && (
                  <div className="flex items-center justify-center gap-2 rounded-[20px] bg-green-50 px-4 py-4 font-semibold text-green-700">
                    <CheckCircle size={18} /> Ride Completed
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] bg-blue-50 p-5">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-[#1d6fff] shadow-[0_10px_24px_rgba(29,111,255,0.12)]">
                  <DollarSign size={20} />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Today</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">$84.50</p>
              </div>

              <div className="rounded-[24px] bg-amber-50 p-5">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-amber-600 shadow-[0_10px_24px_rgba(245,158,11,0.16)]">
                  <Navigation size={20} />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Trips</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">5</p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-950 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200/88">Driver Notes</p>
            <h3 className="mt-3 text-2xl font-bold">Quick rules for smoother handoffs.</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-white/68">
              <p>Confirm the trip code and safe word before loading the child.</p>
              <p>Use the driver status actions in order so parent tracking stays accurate.</p>
              <p>Declined rides stay dismissed for your account until another request appears.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
