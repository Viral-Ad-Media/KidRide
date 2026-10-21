import React, { useEffect, useState } from 'react';
import { DollarSign, Calendar } from 'lucide-react';
import { Card } from '../components/UIComponents';
import { fetchDriverSummary, fetchUserRides, getStoredToken } from '../services/api';
import { Ride } from '../types';
import { formatPickupTime, formatRidePrice, getCompletedRideSummary } from '../utils/rideData';

export const Earnings = () => {
  const [completedRides, setCompletedRides] = useState<Ride[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCompletedRides([]);
      setTotalEarnings(0);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadEarnings = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [rides, totals] = await Promise.all([fetchUserRides('past', token, 100), fetchDriverSummary(token)]);
        if (!isMounted) {
          return;
        }

        setCompletedRides(getCompletedRideSummary(rides).completedRides);
        setTotalEarnings(totals.totalEarnings);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load earnings right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadEarnings();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">

      <div>
        <p className="text-label text-muted">Earned from completed rides</p>
        <p className="mt-1 text-display font-extrabold tabular-nums tracking-tight">{isLoading ? '--' : formatRidePrice(totalEarnings, '$0.00')}</p>
        <p className="mt-1 text-label text-muted">{isLoading ? 'Loading...' : `${completedRides.length} completed ${completedRides.length === 1 ? 'ride' : 'rides'}`}</p>
      </div>

      <h3 className="text-lead font-bold">Completed rides</h3>

      {error ? (
        <Card className="border-red-100 bg-red-50 text-sm text-red-600">
          {error}
        </Card>
      ) : isLoading ? (
        <Card className="text-sm text-gray-500">Loading earnings activity...</Card>
      ) : completedRides.length === 0 ? (
        <Card className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand-deep">
            <DollarSign size={28} />
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-950">No completed ride earnings yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Completed rides will appear here automatically once trips are finished.
          </p>
        </Card>
      ) : (
        <ul className="divide-y divide-line rounded-card bg-white px-4 shadow-[0_1px_2px_rgba(20,33,61,0.06)]">
          {completedRides.map((ride) => (
            <li key={ride.id} className="flex items-center justify-between gap-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-label font-semibold">{ride.pickupLocation} to {ride.dropoffLocation}</p>
                <p className="mt-0.5 flex items-center gap-1 text-caption text-muted"><Calendar size={12} />{formatPickupTime(ride.pickupTime)}</p>
              </div>
              <span className="shrink-0 text-body font-bold tabular-nums">{formatRidePrice(ride.price)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
