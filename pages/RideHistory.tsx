import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRide } from '../contexts/RideContext';
import { Button, Card, StatusChip } from '../components/UIComponents';
import { apiRequest, getStoredToken, mapRide } from '../services/api';
import { Ride } from '../types';
import { ArrowRight, Calendar, Car, ChevronRight, Clock, MapPin } from 'lucide-react';

export const RideHistory = () => {
  const navigate = useNavigate();
  const { activeRide } = useRide();
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'past'>('active');
  const [upcomingRides, setUpcomingRides] = useState<Ride[]>([]);
  const [pastRides, setPastRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'active') {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setError('Sign in to view your ride history.');
      return;
    }

    let isMounted = true;
    const scope = activeTab === 'upcoming' ? 'upcoming' : 'past';

    const loadRides = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiRequest<unknown[]>(`/rides?scope=${scope}&limit=20`, { token });
        if (!isMounted) {
          return;
        }

        const mappedRides = Array.isArray(response) ? response.map(mapRide) : [];
        if (scope === 'upcoming') {
          setUpcomingRides(mappedRides);
        } else {
          setPastRides(mappedRides);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load rides right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadRides();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
        activeTab === id
          ? 'border-[#3A77FF] text-[#3A77FF]'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Rides</h2>
        <Button variant="ghost" className="text-[#3A77FF] font-semibold" onClick={() => navigate('/book')}>
          + Book Ride
        </Button>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <TabButton id="active" label="Active" />
        <TabButton id="upcoming" label="Upcoming" />
        <TabButton id="past" label="Past" />
      </div>

      <div className="space-y-4 animate-fade-in">
        {activeTab === 'active' && (
          <>
            {!activeRide ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-blue-50 text-[#3A77FF] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Car size={32} />
                </div>
                <h3 className="font-bold text-gray-900">No active rides</h3>
                <p className="text-sm text-gray-500 mb-4">You don't have any trips in progress.</p>
                <Button onClick={() => navigate('/book')}>Book a Ride</Button>
              </div>
            ) : (
              <Card onClick={() => navigate(`/tracking/${activeRide.id}`)} className="border-l-4 border-l-green-500">
                <div className="flex justify-between items-center mb-4">
                  <StatusChip status={activeRide.status} />
                  <span className="text-xs font-mono font-bold text-gray-500">CODE: {activeRide.tripCode}</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-[#3A77FF]" />
                    <span className="text-sm font-medium">{activeRide.pickupLocation}</span>
                    <ArrowRight size={12} className="text-gray-400" />
                    <span className="text-sm font-medium">{activeRide.dropoffLocation}</span>
                  </div>
                </div>
                <Button variant="secondary" fullWidth className="h-10 text-sm">Track Live</Button>
              </Card>
            )}
          </>
        )}

        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-500">Loading upcoming rides...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : upcomingRides.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-blue-50 text-[#3A77FF] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar size={32} />
                </div>
                <h3 className="font-bold text-gray-900">No upcoming rides</h3>
                <p className="text-sm text-gray-500">Future bookings will appear here.</p>
              </div>
            ) : (
              upcomingRides.map((ride) => (
                <Card key={ride.id}>
                  <div className="flex items-center gap-3 mb-3 text-sm text-gray-600">
                    <Calendar size={16} className="text-[#3A77FF]" />
                    <span className="font-semibold text-gray-900">{ride.pickupTime}</span>
                  </div>
                  <div className="pl-7 border-l-2 border-gray-100 space-y-2 mb-4">
                    <p className="text-sm flex items-center gap-2">
                      {ride.pickupLocation} <ArrowRight size={12} /> {ride.dropoffLocation}
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Service:</span> <span className="font-medium">{ride.serviceType.replace(/_/g, ' ')}</span>
                    </p>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <StatusChip status={ride.status} />
                    <span className="font-bold text-gray-900">${ride.price.toFixed(2)}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'past' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-500">Loading ride history...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : pastRides.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-blue-50 text-[#3A77FF] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} />
                </div>
                <h3 className="font-bold text-gray-900">No completed rides yet</h3>
                <p className="text-sm text-gray-500">Finished trips will appear here after they wrap up.</p>
              </div>
            ) : (
              pastRides.map((ride) => (
                <Card key={ride.id} className="opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{ride.pickupTime}</p>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {ride.pickupLocation} <ArrowRight size={12} /> {ride.dropoffLocation}
                      </h4>
                    </div>
                    <StatusChip status={ride.status} />
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-xs text-gray-600">{ride.serviceType.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-gray-900">${ride.price.toFixed(2)}</span>
                  </div>
                </Card>
              ))
            )}
            {pastRides.length > 0 && (
              <div className="text-center py-4">
                <button className="text-sm text-gray-500 font-medium flex items-center justify-center gap-1 mx-auto hover:text-[#3A77FF]">
                  Showing latest rides <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
