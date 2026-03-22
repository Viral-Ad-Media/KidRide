import React from 'react';
import { Map, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/UIComponents';
import { useRide } from '../contexts/RideContext';

export const DriverMap = () => {
  const navigate = useNavigate();
  const { activeRide } = useRide();

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center p-6">
      <Card className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-[#3A77FF]">
          <Map size={32} />
        </div>

        {activeRide ? (
          <>
            <h2 className="mt-5 text-2xl font-bold text-gray-900">Current Trip Overview</h2>
            <p className="mt-3 text-sm leading-7 text-gray-500">
              Live map tiles are not connected in this build, but your current trip route is available below.
            </p>

            <div className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-5 text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pickup</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{activeRide.pickupLocation}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Drop-off</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{activeRide.dropoffLocation}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pickup Time</p>
                <p className="mt-2 text-sm text-slate-600">{activeRide.pickupTime || 'Not scheduled'}</p>
              </div>
            </div>

            <Button onClick={() => navigate('/driver-dashboard')} className="mt-6">
              <Navigation size={18} />
              Return to Driver Dashboard
            </Button>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-2xl font-bold text-gray-900">No active trip to map</h2>
            <p className="mt-3 text-sm leading-7 text-gray-500">
              When you accept a ride, the current trip route will appear here.
            </p>
            <Button variant="secondary" onClick={() => navigate('/driver-dashboard')} className="mt-6">
              Back to Driver Dashboard
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};
