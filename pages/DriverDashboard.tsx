
import React, { useState } from 'react';
import { useRide } from '../contexts/RideContext';
import { RideStatus } from '../types';
import { Card, Button, StatusChip } from '../components/UIComponents';
import { MapPin, Navigation, Phone, MessageSquare, CheckCircle, ShieldCheck, DollarSign } from 'lucide-react';

export const DriverDashboard = () => {
  const { activeRide, updateRideStatus } = useRide();
  const [isOnline, setIsOnline] = useState(true);

  // Status Handler
  const handleStatusUpdate = async (nextStatus: RideStatus) => {
    try {
      await updateRideStatus(nextStatus);
    } catch (error) {
      console.error('Unable to update ride status:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Driver Status Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div>
            <h2 className="font-bold text-gray-900">Driver Console</h2>
            <p className={`text-sm flex items-center gap-2 ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                {isOnline ? 'You are Online' : 'You are Offline'}
            </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isOnline} onChange={() => setIsOnline(!isOnline)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3A77FF]"></div>
        </label>
      </div>

      {/* Earnings Summary (Mock) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
             <div className="flex items-center gap-2 text-[#3A77FF] mb-2">
                 <DollarSign size={20} /> <span className="text-xs font-bold uppercase">Today</span>
             </div>
             <p className="text-2xl font-bold text-gray-900">$84.50</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
             <div className="flex items-center gap-2 text-purple-600 mb-2">
                 <Navigation size={20} /> <span className="text-xs font-bold uppercase">Trips</span>
             </div>
             <p className="text-2xl font-bold text-gray-900">5</p>
        </div>
      </div>

      {/* Job Feed / Active Trip */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Current Status</h3>

        {!isOnline ? (
             <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-gray-500">Go online to receive trip requests.</p>
             </div>
        ) : !activeRide ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-[#3A77FF] mb-4">
                    <MapPin size={32} />
                </div>
                <h4 className="font-bold text-gray-900">Scanning Area...</h4>
                <p className="text-sm text-gray-500">Waiting for ride requests nearby.</p>
            </div>
        ) : activeRide.status === RideStatus.SEARCHING_DRIVER || activeRide.status === RideStatus.REQUESTED ? (
            /* NEW REQUEST CARD */
            <div className="bg-white rounded-2xl shadow-lg border-2 border-[#3A77FF] overflow-hidden animate-slide-up">
                <div className="bg-[#3A77FF] p-3 text-white flex justify-between items-center">
                    <span className="font-bold flex items-center gap-2"><ShieldCheck size={18}/> New Request</span>
                    <span className="text-xs font-mono bg-white/20 px-2 py-1 rounded">2 min away</span>
                </div>
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                         <div>
                            <p className="text-3xl font-bold text-gray-900">${activeRide.price.toFixed(2)}</p>
                            <p className="text-sm text-gray-500">Est. Earnings</p>
                         </div>
                         <div className="text-right">
                            <span className="bg-blue-100 text-[#3A77FF] px-2 py-1 rounded text-xs font-bold uppercase">
                                {activeRide.serviceType.replace(/_/g, ' ')}
                            </span>
                         </div>
                    </div>
                    
                    <div className="space-y-4 mb-8">
                        <div className="flex gap-3">
                            <div className="flex flex-col items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                                <div className="w-0.5 h-10 bg-gray-200"></div>
                                <div className="w-3 h-3 rounded-full bg-[#3A77FF]"></div>
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <p className="text-xs text-gray-500">Pickup</p>
                                    <p className="font-medium text-gray-900">{activeRide.pickupLocation}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Drop-off</p>
                                    <p className="font-medium text-gray-900">{activeRide.dropoffLocation}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="secondary" onClick={() => {/* Reject logic */}}>Decline</Button>
                        <Button onClick={() => handleStatusUpdate(RideStatus.DRIVER_ASSIGNED)}>Accept Ride</Button>
                    </div>
                </div>
            </div>
        ) : (
            /* ACTIVE TRIP CONSOLE */
            <Card className="border-l-4 border-l-green-500">
                <div className="flex justify-between items-center mb-6">
                    <StatusChip status={activeRide.status} />
                    <div className="flex gap-2">
                        <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><Phone size={18}/></button>
                        <button className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><MessageSquare size={18}/></button>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500">Trip Code</span>
                        <span className="text-xl font-mono font-bold">{activeRide.tripCode}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Safe Word</span>
                        <span className="font-bold text-[#3A77FF]">"{activeRide.safeWord}"</span>
                    </div>
                </div>

                <div className="space-y-3">
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
                        <Button fullWidth onClick={() => handleStatusUpdate(RideStatus.COMPLETED)} className="bg-green-600 hover:bg-green-700 text-white">
                            Complete Ride
                        </Button>
                    )}
                    {activeRide.status === RideStatus.COMPLETED && (
                        <div className="text-center py-4 text-green-600 font-bold flex items-center justify-center gap-2">
                            <CheckCircle /> Ride Completed!
                        </div>
                    )}
                </div>
            </Card>
        )}
      </div>
    </div>
  );
};
