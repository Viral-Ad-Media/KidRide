
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRide } from '../contexts/RideContext';
import { INITIAL_RIDES } from '../constants';
import { Card, StatusChip, Button } from '../components/UIComponents';
import { Car, Calendar, MapPin, Clock, ArrowRight, ChevronRight } from 'lucide-react';

export const RideHistory = () => {
  const navigate = useNavigate();
  const { activeRide } = useRide();
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'past'>('active');

  // Combine historical data (simulated)
  const pastRides = INITIAL_RIDES;
  
  // Simulated upcoming rides
  const upcomingRides = [
    {
      id: 'u1',
      childName: 'Maya',
      date: 'Tomorrow, 8:00 AM',
      pickup: 'Home',
      dropoff: 'Lincoln Elementary',
      driverName: 'Mike Ross',
      price: 12.00
    }
  ];

  const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
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
        {/* ACTIVE TAB */}
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

        {/* UPCOMING TAB */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {upcomingRides.map(ride => (
              <Card key={ride.id}>
                <div className="flex items-center gap-3 mb-3 text-sm text-gray-600">
                    <Calendar size={16} className="text-[#3A77FF]" />
                    <span className="font-semibold text-gray-900">{ride.date}</span>
                </div>
                <div className="pl-7 border-l-2 border-gray-100 space-y-2 mb-4">
                    <p className="text-sm"><span className="text-gray-500">Passenger:</span> <span className="font-medium">{ride.childName}</span></p>
                    <p className="text-sm"><span className="text-gray-500">Driver:</span> <span className="font-medium">{ride.driverName}</span></p>
                    <p className="text-sm flex items-center gap-2">
                        {ride.pickup} <ArrowRight size={12} /> {ride.dropoff}
                    </p>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="font-bold text-gray-900">${ride.price.toFixed(2)}</span>
                    <button className="text-sm text-red-500 font-medium hover:underline">Cancel</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* PAST TAB */}
        {activeTab === 'past' && (
          <div className="space-y-4">
            {pastRides.map(ride => (
              <Card key={ride.id} className="opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-xs text-gray-500 mb-1">
                            {ride.pickupTime.includes('Today') ? 'Today' : ride.pickupTime}
                        </p>
                        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            {ride.pickupLocation} <ArrowRight size={12}/> {ride.dropoffLocation}
                        </h4>
                    </div>
                    <StatusChip status={ride.status} />
                </div>
                <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center gap-2">
                        <img src="https://picsum.photos/100/100?random=3" className="w-6 h-6 rounded-full" />
                        <span className="text-xs text-gray-600">Sarah J.</span>
                    </div>
                    <span className="font-bold text-gray-900">${ride.price.toFixed(2)}</span>
                </div>
              </Card>
            ))}
            <div className="text-center py-4">
                <button className="text-sm text-gray-500 font-medium flex items-center justify-center gap-1 mx-auto hover:text-[#3A77FF]">
                    View older rides <ChevronRight size={16} />
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
