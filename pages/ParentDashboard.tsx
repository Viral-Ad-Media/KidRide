
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, ArrowRight, Car } from 'lucide-react';
import { Card, Button, Badge, StatusChip } from '../components/UIComponents';
import { MOCK_CHILDREN, MOCK_CARPOOLS } from '../constants';
import {  ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useRide } from '../contexts/RideContext';

const data = [
  { name: 'Mon', rides: 2 },
  { name: 'Tue', rides: 1 },
  { name: 'Wed', rides: 3 },
  { name: 'Thu', rides: 2 },
  { name: 'Fri', rides: 4 },
  { name: 'Sat', rides: 5 },
  { name: 'Sun', rides: 2 },
];

export const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeRide } = useRide();
  const availableChildren = user?.children && user.children.length > 0 ? user.children : MOCK_CHILDREN;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Good Morning, {user?.name.split(' ')[0] || 'Parent'}!</h2>
        <p className="text-gray-500">Who needs a ride today?</p>
      </div>

      {/* Active Ride Card */}
      {activeRide && (
        <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    Live Ride Active
                </h3>
             </div>
             <Card className="border-l-4 border-l-[#3A77FF] bg-blue-50/50" onClick={() => navigate(`/tracking/${activeRide.id}`)}>
                <div className="flex justify-between items-start mb-4">
                    <StatusChip status={activeRide.status} />
                    <span className="text-xs font-mono font-bold text-gray-500">CODE: {activeRide.tripCode}</span>
                </div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-full shadow-sm">
                        <Car size={20} className="text-[#3A77FF]"/>
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">En Route</p>
                        <p className="text-xs text-gray-500">ETA: 5 mins</p>
                    </div>
                    <ArrowRight className="ml-auto text-gray-400" size={20} />
                </div>
                <div className="text-sm text-gray-600 pl-11">
                    {activeRide.pickupLocation} <ArrowRight size={12} className="inline mx-1"/> {activeRide.dropoffLocation}
                </div>
             </Card>
        </div>
      )}

      {/* Children Quick Select */}
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        <div className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer" onClick={() => navigate('/add-child')}>
          <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-[#3A77FF] hover:text-[#3A77FF] transition-colors">
            <Plus size={28} />
          </div>
          <span className="text-xs font-medium text-gray-500">Add Child</span>
        </div>
        
        <div className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer" onClick={() => navigate('/book')}>
          <div className="w-16 h-16 rounded-full bg-[#3A77FF] flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Car size={28} />
          </div>
          <span className="text-xs font-medium text-[#3A77FF]">Book Ride</span>
        </div>

        {availableChildren.map(child => (
          <div key={child.id} className="flex-shrink-0 flex flex-col items-center gap-2">
            <img src={child.photoUrl} alt={child.name} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" />
            <span className="text-xs font-medium text-gray-600">{child.name}</span>
          </div>
        ))}
      </div>

      {/* Usage Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Ride Activity (This Week)</h3>
        <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorRides" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3A77FF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3A77FF" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="rides" stroke="#3A77FF" strokeWidth={3} fillOpacity={1} fill="url(#colorRides)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Next Game / Carpool Highlight */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900">Suggested Carpools</h3>
          <button onClick={() => navigate('/carpools')} className="text-[#3A77FF] text-sm font-semibold">See All</button>
        </div>
        
        <div className="space-y-4">
          {MOCK_CARPOOLS.slice(0, 1).map(offer => (
            <Card key={offer.id} className="relative overflow-hidden" onClick={() => navigate('/carpools')}>
              <div className="absolute top-0 right-0 p-3">
                 <Badge type="team" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <img src={offer.parentPhoto} alt={offer.parentName} className="w-12 h-12 rounded-full" />
                <div>
                  <p className="font-semibold text-gray-900">{offer.parentName}</p>
                  <p className="text-xs text-gray-500">Going to {offer.eventName}</p>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={16} className="text-[#3A77FF]" />
                  <span>{offer.fromLocation} <ArrowRight size={12} className="inline mx-1"/> {offer.toLocation}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} className="text-[#3A77FF]" />
                  <span>{offer.departureTime}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-100">
                <span className="text-xs font-medium text-gray-500">{offer.seatsAvailable} seats left</span>
                <span className="font-bold text-[#3A77FF]">${offer.pricePerSeat}/seat</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

       {/* Promo / CTA */}
       <div className="bg-gradient-to-r from-[#6C63FF] to-[#3A77FF] rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-lg font-bold mb-1">Verify as a Parent Driver</h3>
                <p className="text-white/80 text-sm mb-4">Help your team, earn extra cash.</p>
                <button 
                  onClick={() => navigate('/profile')} 
                  className="bg-white text-[#3A77FF] px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-opacity-90 transition-opacity"
                >
                    Get Verified
                </button>
            </div>
            {/* Abstract Shape */}
            <div className="absolute -right-4 -bottom-8 w-32 h-32 bg-white/20 rounded-full blur-xl"></div>
       </div>
    </div>
  );
};
