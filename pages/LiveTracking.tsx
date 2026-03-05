
import React, { useState, useEffect } from 'react';
import { RideMap } from '../components/RideMap';
import { Card, Button, StatusChip, Badge } from '../components/UIComponents';
import { Phone, MessageSquare, ShieldAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MOCK_DRIVERS } from '../constants';
import { useRide } from '../contexts/RideContext';
import { RideStatus } from '../types';

export const LiveTracking = () => {
  const navigate = useNavigate();
  const { activeRide } = useRide();
  const [localStatus, setLocalStatus] = useState<RideStatus>(RideStatus.DRIVER_ASSIGNED);
  
  // Driver Info (Simulated Assigned Driver)
  const driver = MOCK_DRIVERS[0];
  const tripCode = activeRide?.tripCode || "4829";
  const safeWord = activeRide?.safeWord || "Lions";

  // Sync active ride status to local component
  useEffect(() => {
    if (activeRide) {
        setLocalStatus(activeRide.status);
    }
  }, [activeRide]);

  if (!activeRide) {
      // Fallback for demo direct access without booking
      return (
        <div className="h-screen flex items-center justify-center bg-gray-100 flex-col gap-4">
             <p className="text-gray-500">No active ride found.</p>
             <Button onClick={() => navigate('/book')}>Book a Ride</Button>
        </div>
      );
  }

  return (
    <div className="h-[calc(100vh-80px)] md:h-[600px] flex flex-col relative bg-gray-100">
      {/* Map Area */}
      <div className="flex-1 relative">
        <button 
            onClick={() => navigate('/dashboard')}
            className="absolute top-4 left-4 z-10 bg-white p-2 rounded-full shadow-md"
        >
            <X size={24} />
        </button>
        <RideMap status={localStatus} />
      </div>

      {/* Bottom Sheet */}
      <div className="bg-white rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-6 animate-slide-up relative z-10 -mt-6">
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6"></div>

        {/* Status Header */}
        <div className="flex justify-between items-center mb-6">
            <StatusChip status={localStatus} />
            <div className="text-right">
                <p className="text-xs text-gray-500">Trip Code</p>
                <p className="text-xl font-mono font-bold text-gray-900 tracking-widest">{tripCode}</p>
            </div>
        </div>

        {/* Driver Card */}
        <div className="flex items-center gap-4 mb-6">
            <div className="relative">
                <img src={driver.photoUrl} className="w-16 h-16 rounded-full border-2 border-white shadow-md object-cover" />
                <div className="absolute -bottom-1 -right-1 bg-white rounded-lg p-0.5">
                     <Badge type={driver.isGoldVerified ? 'gold' : 'verified'} />
                </div>
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-lg">{driver.name}</h3>
                <p className="text-sm text-gray-500">{driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono font-bold">{driver.vehicle.plate}</span>
                    <span className="text-xs text-gray-400">★ {driver.rating}</span>
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <button className="p-3 bg-green-50 text-green-600 rounded-full hover:bg-green-100">
                    <Phone size={20} />
                </button>
                <button className="p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100">
                    <MessageSquare size={20} />
                </button>
            </div>
        </div>

        {/* Safe Word / Safety Info */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-6">
            <div className="flex items-start gap-3">
                <ShieldAlert className="text-[#3A77FF] mt-1 shrink-0" size={20} />
                <div>
                    <p className="text-sm font-bold text-[#3A77FF]">Safety Check</p>
                    <p className="text-sm text-blue-800 mt-1">
                        Driver must say the Safe Word: <span className="font-bold bg-white px-2 py-0.5 rounded border border-blue-200">"{safeWord}"</span>
                    </p>
                </div>
            </div>
        </div>

        {/* Actions */}
        <Button variant="destructive" className="w-full bg-red-50 text-red-500 hover:bg-red-100 border-none">
            Report Safety Issue
        </Button>
      </div>
    </div>
  );
};
