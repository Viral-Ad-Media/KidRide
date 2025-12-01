
import React from 'react';
import { Map, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DriverMap = () => {
  const navigate = useNavigate();
  return (
    <div className="h-[calc(100vh-140px)] relative bg-gray-200 flex flex-col items-center justify-center text-center p-6">
       <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm">
           <div className="w-16 h-16 bg-blue-100 text-[#3A77FF] rounded-full flex items-center justify-center mx-auto mb-4">
               <Map size={32} />
           </div>
           <h2 className="text-xl font-bold text-gray-900 mb-2">Driver Heatmap</h2>
           <p className="text-gray-500 mb-6">
               This screen would show high-demand areas and allow you to navigate to your waiting spot.
           </p>
           <button onClick={() => navigate('/driver-dashboard')} className="text-[#3A77FF] font-semibold hover:underline">
               Return to Dashboard
           </button>
       </div>
    </div>
  );
};
