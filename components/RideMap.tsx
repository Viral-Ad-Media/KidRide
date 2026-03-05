import React, { useEffect, useState } from 'react';
import { Car, MapPin } from 'lucide-react';

interface RideMapProps {
  status: string;
}

export const RideMap: React.FC<RideMapProps> = ({ status }) => {
  const [progress, setProgress] = useState(10);

  // Simulate movement based on status
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'driver_assigned') {
      // Move towards pickup (0 -> 45)
      setProgress(10);
      interval = setInterval(() => {
        setProgress(p => (p < 45 ? p + 0.5 : 45));
      }, 100);
    } else if (status === 'driver_arrived_at_pickup') {
      setProgress(50);
    } else if (status === 'child_picked_up') {
      // Move towards dropoff (50 -> 90)
      setProgress(50);
      interval = setInterval(() => {
        setProgress(p => (p < 90 ? p + 0.2 : 90));
      }, 100);
    } else if (status === 'completed') {
      setProgress(100);
    }

    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="relative w-full h-full bg-[#E5E9F2] overflow-hidden rounded-2xl">
      {/* Map Background Pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-30" width="100%" height="100%">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="2"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Roads */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Main Route Path */}
        <path 
          d="M 50 300 Q 150 250 200 150 T 350 50" 
          fill="none" 
          stroke="white" 
          strokeWidth="20" 
          strokeLinecap="round"
        />
        <path 
          id="routePath"
          d="M 50 300 Q 150 250 200 150 T 350 50" 
          fill="none" 
          stroke="#3A77FF" 
          strokeWidth="6" 
          strokeDasharray="10 5"
          strokeLinecap="round"
          className="animate-pulse"
        />
        
        {/* Pickup Pin (Start) */}
        <circle cx="50" cy="300" r="8" fill="#3A77FF" />
        
        {/* Dropoff Pin (End) */}
        <circle cx="350" cy="50" r="8" fill="#26C281" />
      </svg>

      {/* Moving Car */}
      <div 
        className="absolute transition-all duration-300 ease-linear shadow-xl bg-white p-1.5 rounded-full"
        style={{
          // Simple linear interpolation approximation for demo
          // In a real app, we'd calculate point at length on SVG path
          left: `${progress}%`,
          top: `${100 - progress * 0.8}%`, // Rough diagonal movement
          transform: 'translate(-50%, -50%)'
        }}
      >
        <Car size={20} className="text-[#3A77FF] fill-current" />
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-sm border border-white/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-full text-blue-600">
            <MapPin size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">Current Location</p>
            <p className="text-sm font-medium text-gray-900">
               {progress < 45 ? "Heading to Pickup" : progress < 90 ? "En Route to Destination" : "Arrived"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};