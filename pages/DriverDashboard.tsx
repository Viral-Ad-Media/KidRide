import React, { useEffect, useState } from 'react';
import { CheckCircle, TimerReset } from 'lucide-react';
import { Button, Card, ConfirmModal, StatusChip } from '../components/UIComponents';
import { StickyNote } from '../components/StickyNote';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { useDriverRating } from '../components/Ratings';
import { LiveMap } from '../components/LiveMap';
import { DriverUpcomingRides, ScheduleChip } from '../components/UpcomingRides';
import { DriverIdleMap } from '../components/DriverIdleMap';
import { fetchDriverSummary, getStoredToken } from '../services/api';
import { RideStatus } from '../types';
import { formatPickupTime, formatRidePrice } from '../utils/rideData';

import { useDriverLocation } from '../services/driverLocation';

const humanizeStatus = (status: string) => status.replace(/_/g, ' ');

// Time left on an offer made to this driver (nearest-driver dispatch).
const OfferCountdown: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  const total = 20000;
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  return (
    <div className="mt-4" role="timer" aria-live="polite">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-brand-deep">You are the nearest driver</span>
        <span className={left < 6000 ? 'text-red-600' : 'text-slate-600'}>{left > 0 ? `${Math.ceil(left / 1000)}s to accept` : 'Offer expired'}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-[width] duration-200 ${left < 6000 ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </div>
    </div>
  );
};

export const DriverDashboard = () => {
  const { activeRide, updateRideStatus, declineRideRequest, syncError, cancelRide, acceptRide, isOnline, setIsOnline } = useRide();
  const { user } = useAuth();
  const rating = useDriverRating(user?.id);
  const locationError = useDriverLocation();
  const [isDeclining, setIsDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);
  // Reload the totals when the current trip finishes so they include it.
  const rideCompleted = activeRide?.status === RideStatus.COMPLETED;

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCompletedCount(0);
      setTotalEarnings(0);
      setIsMetricsLoading(false);
      return;
    }

    let isMounted = true;

    const loadMetrics = async () => {
      setIsMetricsLoading(true);

      try {
        const summary = await fetchDriverSummary(token);
        if (!isMounted) {
          return;
        }

        setCompletedCount(summary.completedCount);
        setTotalEarnings(summary.totalEarnings);
      } catch {
        if (isMounted) {
          setCompletedCount(0);
          setTotalEarnings(0);
        }
      } finally {
        if (isMounted) {
          setIsMetricsLoading(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      isMounted = false;
    };
  }, [rideCompleted]);

  const handleStatusUpdate = async (nextStatus: RideStatus) => {
    try {
      setError(null);
      await updateRideStatus(nextStatus);
    } catch (statusError) {
      console.error('Unable to update ride status:', statusError);
      // Show the server's reason (wrong order, trip already changed, signed out) rather than a generic line.
      setError(statusError instanceof Error && statusError.message ? `Could not update the trip: ${statusError.message}` : 'Could not update the trip. Check your connection and try again.');
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

  const confirmCancel = async () => {
    setCancelling(true);
    try { await cancelRide(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel the ride.'); }
    finally { setCancelling(false); setConfirmingCancel(false); }
  };

  const childName = activeRide?.child?.name?.split(' ')[0] || 'the child';
  const offerOpen = !!activeRide && [RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER].includes(activeRide.status);
  const tripHeadline = !activeRide ? ''
    : activeRide.status === RideStatus.DRIVER_ASSIGNED ? 'Head to the pickup'
    : activeRide.status === RideStatus.DRIVER_ARRIVED ? `Waiting for ${childName}`
    : activeRide.status === RideStatus.IN_PROGRESS ? `Driving ${childName} to the drop-off`
    : activeRide.status === RideStatus.COMPLETED ? 'Trip complete' : '';

  // Pickup and drop-off as a two-stop line: Marigold ring for the pickup, navy dot for the drop-off.
  const stops = (pickupDone = false) => (
    <div className="grid grid-cols-[14px_1fr] gap-x-3 gap-y-1">
      <span className="mt-1.5 h-3 w-3 rounded-full border-[3px] border-accent bg-white" />
      <p className={`text-body font-semibold ${pickupDone ? 'text-muted line-through' : ''}`}>{activeRide?.pickupLocation}</p>
      <span className="ml-[5px] h-5 w-0.5 bg-line" /><span />
      <span className="mt-1.5 h-3 w-3 rounded-full bg-ink" />
      <p className="text-body font-semibold">{activeRide?.dropoffLocation}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title font-extrabold tracking-tight sm:text-headline">{isOnline ? "You're online" : "You're offline"}</h2>
          <p className="mt-1 text-sm text-muted">{isOnline ? 'Nearby ride requests will appear here.' : 'Go online to receive ride requests.'}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-3 self-start rounded-full border border-line bg-white py-2 pl-4 pr-2 sm:self-auto">
          <span className="text-sm font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
          <input type="checkbox" checked={isOnline} onChange={() => setIsOnline(!isOnline)} className="peer sr-only" />
          <span className="relative h-7 w-12 rounded-full bg-line transition after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-success peer-checked:after:translate-x-5" />
        </label>
      </section>

      <div className="grid grid-cols-3 divide-x divide-line rounded-card border border-line bg-white">
        <div className="px-4 py-4"><p className="text-xs text-muted">Earned</p><p className="mt-1 text-title font-extrabold tabular-nums">{isMetricsLoading ? '--' : formatRidePrice(totalEarnings, '$0.00')}</p></div>
        <div className="px-4 py-4"><p className="text-xs text-muted">Trips</p><p className="mt-1 text-title font-extrabold tabular-nums">{isMetricsLoading ? '--' : completedCount}</p></div>
        <div className="px-4 py-4"><p className="text-xs text-muted">Rating</p><p className="mt-1 text-title font-extrabold tabular-nums">{rating?.count && rating.average !== null ? `\u2605 ${rating.average.toFixed(1)}` : '\u2013'}</p></div>
      </div>

      {(syncError || locationError) && <p className="text-label text-warning">{syncError || locationError}</p>}
      {error && <p className="text-label text-danger">{error}</p>}

      <div className="space-y-6">
          {!isOnline && (!activeRide || offerOpen) ? (
            <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted"><TimerReset size={26} /></span>
              <h3 className="mt-4 text-lead font-bold">You're off the road</h3>
              <p className="mt-1 text-label text-muted">Switch to Online to start receiving requests.</p>
            </div>
          ) : !activeRide ? (
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-deep" /></span>
                <h3 className="text-lead font-bold">Looking for rides near you</h3>
              </div>
              <p className="text-label text-muted">Marigold pins are families waiting nearby. Tap one to see the trip and accept it.</p>
              <DriverIdleMap onAccept={acceptRide} />
            </div>
          ) : offerOpen ? (
            <div className="overflow-hidden rounded-card border-2 border-brand bg-white">
              <div className="flex items-start justify-between gap-4 px-5 pt-5">
                <div>
                  <p className="text-label font-semibold text-brand-deep">New request{activeRide.isScheduled ? ' (booked ahead)' : ''}</p>
                  <p className="mt-1 text-display font-extrabold tabular-nums tracking-tight">{formatRidePrice(activeRide.price)}</p>
                  <p className="text-label text-muted">{humanizeStatus(activeRide.serviceType)} \u00b7 Pickup {formatPickupTime(activeRide.pickupTime, 'now')}</p>
                </div>
                {activeRide.offerExpiresAt && <OfferCountdown expiresAt={activeRide.offerExpiresAt} />}
              </div>
              <div className="mx-5 mt-4 border-t border-line pt-4">{stops()}</div>
              <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3 px-5 pb-5">
                <Button variant="secondary" onClick={() => void handleDecline()} disabled={isDeclining}>{isDeclining ? '...' : 'Decline'}</Button>
                <Button onClick={() => handleStatusUpdate(RideStatus.DRIVER_ASSIGNED)} disabled={isDeclining}>Accept</Button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-card border border-line bg-white">
              <div className="px-5 pt-5">
                <StatusChip status={activeRide.status} />
                <h3 className="mt-3 text-title font-extrabold tracking-tight">{tripHeadline}</h3>
                <p className="mt-1 text-label text-muted">Pickup {formatPickupTime(activeRide.pickupTime, 'now')} \u00b7 {formatRidePrice(activeRide.price)}</p>
              </div>
              <div className="mx-5 mt-4 flex items-center justify-between rounded-card bg-accent/15 px-4 py-3">
                <span>
                  <span className="block text-caption font-semibold text-muted">Trip code</span>
                  <span className="block text-caption text-muted">Say the safe word to the parent</span>
                </span>
                <span className="text-right">
                  <span className="block text-title font-extrabold tabular-nums tracking-wider">{activeRide.tripCode || '\u00b7\u00b7\u00b7\u00b7'}</span>
                  <span className="block text-caption font-semibold">{activeRide.safeWord || 'Pending'}</span>
                </span>
              </div>
              <div className="mx-5 mt-4">{stops(activeRide.status === RideStatus.IN_PROGRESS)}</div>
              <LiveMap
                pickup={activeRide.pickupLocation}
                dropoff={activeRide.dropoffLocation}
                pickupCoords={activeRide.pickupCoords}
                dropoffCoords={activeRide.dropoffCoords}
                driverLocation={activeRide.driverLocation}
                nextStop={activeRide.status === RideStatus.IN_PROGRESS ? 'dropoff' : 'pickup'}
                className="mt-4 h-64 rounded-none"
              />
              <div className="space-y-3 p-5">
                {activeRide.status === RideStatus.DRIVER_ASSIGNED && <Button fullWidth onClick={() => handleStatusUpdate(RideStatus.DRIVER_ARRIVED)}>I've arrived at the pickup</Button>}
                {activeRide.status === RideStatus.DRIVER_ARRIVED && <Button fullWidth onClick={() => handleStatusUpdate(RideStatus.IN_PROGRESS)}>{childName} is in the car</Button>}
                {activeRide.status === RideStatus.IN_PROGRESS && <Button fullWidth onClick={() => handleStatusUpdate(RideStatus.COMPLETED)} className="bg-success text-white hover:brightness-95">Dropped off</Button>}
                {activeRide.status === RideStatus.COMPLETED && <p className="flex items-center justify-center gap-2 text-label font-semibold text-success"><CheckCircle size={18} /> Ride completed</p>}
                {![RideStatus.IN_PROGRESS, RideStatus.COMPLETED, RideStatus.CANCELLED].includes(activeRide.status) && (
                  <button type="button" onClick={() => setConfirmingCancel(true)} className="w-full text-center text-label font-semibold text-danger">Cancel ride</button>
                )}
                <ConfirmModal open={confirmingCancel} title="Cancel this ride?" body="The trip will be cancelled for you and the parent." confirmLabel="Cancel ride" tone="danger" busy={cancelling} onConfirm={() => void confirmCancel()} onClose={() => setConfirmingCancel(false)} />
              </div>
            </div>
          )}

          <DriverUpcomingRides refreshKey={`${activeRide?.id || ''}:${activeRide?.status || ''}`} />
      </div>

      <StickyNote
        id="driver-before-pickup"
        title="Before every pickup"
        lines={['Check the trip code and safe word before the child gets in.', 'Tap the status buttons in order so the parent\u2019s tracking stays right.']}
      />
    </div>
  );
};
