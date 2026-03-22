import React, { useEffect, useState } from 'react';
import { DollarSign, Calendar } from 'lucide-react';
import { Card } from '../components/UIComponents';
import { fetchUserRides, getStoredToken } from '../services/api';
import { Ride } from '../types';
import { formatRidePrice, getCompletedRideSummary } from '../utils/rideData';

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
        const rides = await fetchUserRides('past', token, 100);
        if (!isMounted) {
          return;
        }

        const summary = getCompletedRideSummary(rides);
        setCompletedRides(summary.completedRides);
        setTotalEarnings(summary.totalEarnings);
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
      <h2 className="text-2xl font-bold text-gray-900">Earnings</h2>

      <div className="rounded-2xl bg-[#3A77FF] p-6 text-white shadow-lg shadow-blue-500/30">
        <p className="mb-1 font-medium text-blue-100">Completed Ride Earnings</p>
        <h1 className="mb-4 text-4xl font-bold">{isLoading ? '--' : formatRidePrice(totalEarnings, '$0.00')}</h1>
        <div className="rounded-lg bg-white/20 px-4 py-3 text-sm font-semibold backdrop-blur-sm">
          {isLoading ? 'Loading earnings...' : `${completedRides.length} completed ${completedRides.length === 1 ? 'ride' : 'rides'}`}
        </div>
      </div>

      <h3 className="mt-6 font-bold text-gray-900">Completed Rides</h3>

      {error ? (
        <Card className="border-red-100 bg-red-50 text-sm text-red-600">
          {error}
        </Card>
      ) : isLoading ? (
        <Card className="text-sm text-gray-500">Loading earnings activity...</Card>
      ) : completedRides.length === 0 ? (
        <Card className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#3A77FF]">
            <DollarSign size={28} />
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-950">No completed ride earnings yet</h3>
          <p className="mt-2 text-sm text-slate-500">
            Completed rides will appear here automatically once trips are finished.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {completedRides.map((ride) => (
            <Card key={ride.id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <DollarSign size={20} />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{ride.pickupLocation} to {ride.dropoffLocation}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar size={12} />
                    {ride.pickupTime}
                  </p>
                </div>
              </div>
              <span className="font-bold text-green-600">{formatRidePrice(ride.price)}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
