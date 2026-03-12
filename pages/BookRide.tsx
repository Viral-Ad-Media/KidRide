
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card, Select } from '../components/UIComponents';
import { MOCK_CHILDREN } from '../constants';
import { ArrowLeft, MapPin, Search, ShieldCheck, Map } from 'lucide-react';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { RideStatus, ServiceType, Ride } from '../types';

export const BookRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestRide, activeRide } = useRide();
  const [step, setStep] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const availableChildren = user?.children && user.children.length > 0 ? user.children : MOCK_CHILDREN;
  
  const [formData, setFormData] = useState({
    childId: '',
    pickup: '',
    dropoff: '',
    serviceType: 'pickup_only',
  });

  useEffect(() => {
    if (!formData.childId && availableChildren.length > 0) {
      setFormData((prev) => ({ ...prev, childId: availableChildren[0].id }));
    }
  }, [availableChildren, formData.childId]);

  // Watch for driver acceptance
  useEffect(() => {
    if (activeRide && activeRide.status === RideStatus.DRIVER_ASSIGNED) {
        navigate(`/tracking/${activeRide.id}`);
    }
  }, [activeRide, navigate]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else void startDriverSearch();
  };

  const startDriverSearch = async () => {
    setIsSearching(true);
    setSearchStatus('Broadcasting to verified drivers...');

    // Create new ride object with SEARCHING status
    const newRide: Ride = {
          id: `ride-${Date.now()}`,
          childId: formData.childId,
          pickupLocation: formData.pickup || 'Home',
          dropoffLocation: formData.dropoff || 'City Sports Complex',
          pickupTime: new Date().toLocaleTimeString(),
          status: RideStatus.SEARCHING_DRIVER, // Waiting for driver
          price: 18.50,
          tripCode: '4829',
          safeWord: 'Lions',
          serviceType: formData.serviceType as ServiceType,
          driverId: undefined // No driver yet
    };
    
    try {
      // Post to backend through context
      await requestRide(newRide);
    } catch (error) {
      console.error('Ride request failed:', error);
      setSearchStatus('Unable to reach ride service. Please try again.');
      setTimeout(() => setIsSearching(false), 1500);
      return;
    }
    
    // Aesthetic simulation messages only (logic is handled by context/driver)
    const searchSequence = [
      { msg: 'Contacting verified drivers...', delay: 2000 },
      { msg: 'Waiting for acceptance...', delay: 4000 },
    ];

    searchSequence.forEach(({ msg, delay }) => {
      setTimeout(() => setSearchStatus(msg), delay);
    });
  };

  // Searching Screen UI
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in p-6">
        <div className="relative">
           {/* Radar Ping Animation */}
           <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
           <div className="absolute inset-[-20px] bg-blue-500 rounded-full animate-ping opacity-10 animation-delay-500"></div>
           
           <div className="relative bg-white p-6 rounded-full shadow-xl border-4 border-blue-50 z-10">
              <Search size={48} className="text-[#3A77FF]" />
           </div>
        </div>

        <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Finding your ride</h2>
            <p className="text-[#3A77FF] font-medium h-6">{searchStatus}</p>
        </div>

        <div className="max-w-xs w-full bg-gray-100 rounded-xl p-4 text-left space-y-3">
             <div className="flex items-center gap-3">
                <ShieldCheck size={16} className="text-green-500" />
                <span className="text-xs text-gray-600">Request sent to nearby drivers</span>
             </div>
             <div className="flex items-center gap-3">
                <Map size={16} className="text-blue-500" />
                <span className="text-xs text-gray-600">Waiting for driver confirmation...</span>
             </div>
        </div>
        
        <div className="mt-8 text-xs text-gray-400 max-w-[220px]">
            Tip: Open a second tab, sign in with a driver account, and accept this request.
        </div>
      </div>
    );
  }

  return (
    <div>
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-xl font-bold">Book a Ride</h2>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
            {[1, 2, 3].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[#3A77FF]' : 'bg-gray-200'}`} />
            ))}
        </div>

        {step === 1 && (
            <div className="space-y-6 fade-in">
                <h3 className="text-lg font-semibold">Who is this ride for?</h3>
                <div className="grid grid-cols-2 gap-4">
                    {availableChildren.map(child => (
                        <div 
                            key={child.id}
                            onClick={() => setFormData({...formData, childId: child.id})}
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-3 ${formData.childId === child.id ? 'border-[#3A77FF] bg-blue-50' : 'border-gray-100 bg-white'}`}
                        >
                            <img src={child.photoUrl} className="w-16 h-16 rounded-full" />
                            <span className="font-medium text-sm">{child.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6 fade-in">
                <h3 className="text-lg font-semibold">Where and When?</h3>
                <Input 
                    label="Pickup Location" 
                    placeholder="e.g. Home, 123 Maple St" 
                    value={formData.pickup}
                    onChange={(e) => setFormData({...formData, pickup: e.target.value})}
                />
                <Input 
                    label="Drop-off Location" 
                    placeholder="e.g. Soccer Field" 
                    value={formData.dropoff}
                    onChange={(e) => setFormData({...formData, dropoff: e.target.value})}
                />
                <Select 
                    label="Service Type"
                    value={formData.serviceType}
                    onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
                >
                    <option value="pickup_only">Pickup Only (Driver drops off)</option>
                    <option value="pickup_and_dropoff">Round Trip</option>
                    <option value="stay_with_child_and_dropoff">Stay & Supervise</option>
                </Select>
            </div>
        )}

        {step === 3 && (
            <div className="space-y-6 fade-in">
                <h3 className="text-lg font-semibold">Review & Confirm</h3>
                <Card className="bg-gray-50 border-gray-200">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-full shadow-sm">
                                <MapPin size={20} className="text-[#3A77FF]" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Pickup</p>
                                <p className="font-medium">{formData.pickup || "Home"}</p>
                            </div>
                        </div>
                        <div className="w-0.5 h-4 bg-gray-300 ml-5 my-1"></div>
                        <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-full shadow-sm">
                                <MapPin size={20} className="text-[#26C281]" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Drop-off</p>
                                <p className="font-medium">{formData.dropoff || "City Sports Complex"}</p>
                            </div>
                        </div>
                    </div>
                </Card>

                <div className="flex justify-between items-center py-4 border-t border-b border-gray-100">
                    <span className="text-gray-600">Estimated Price</span>
                    <span className="text-2xl font-bold text-gray-900">$18.50</span>
                </div>

                <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-yellow-800">
                    The app will use your location to find the nearest Gold Verified driver or Team Parent.
                </div>
            </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 md:relative md:border-none md:p-0 md:mt-8">
            <Button onClick={handleNext} fullWidth disabled={isSearching}>
                {step === 3 ? 'Confirm & Book' : 'Next'}
            </Button>
        </div>
    </div>
  );
};
