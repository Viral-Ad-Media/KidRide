import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card, Select } from '../components/UIComponents';
import { ArrowLeft, MapPin, Search, ShieldCheck, Map } from 'lucide-react';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { RideStatus, ServiceType, Ride } from '../types';

const childInitials = (name: string) => (
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'C'
);

const serviceTypeLabels: Record<string, string> = {
  pickup_only: 'Pickup Only',
  pickup_and_dropoff: 'Round Trip',
  stay_with_child_and_dropoff: 'Stay & Supervise'
};

export const BookRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestRide, activeRide } = useRide();
  const [step, setStep] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const availableChildren = user?.children || [];
  const hasChildren = availableChildren.length > 0;

  const [formData, setFormData] = useState({
    childId: '',
    pickup: '',
    dropoff: '',
    serviceType: 'pickup_only'
  });

  const selectedChild = availableChildren.find((child) => child.id === formData.childId);
  const trimmedPickup = formData.pickup.trim();
  const trimmedDropoff = formData.dropoff.trim();

  useEffect(() => {
    const hasSelectedChild = availableChildren.some((child) => child.id === formData.childId);

    if (availableChildren.length === 0) {
      if (formData.childId) {
        setFormData((prev) => ({ ...prev, childId: '' }));
      }
      return;
    }

    if (!hasSelectedChild) {
      setFormData((prev) => ({ ...prev, childId: availableChildren[0].id }));
    }
  }, [availableChildren, formData.childId]);

  useEffect(() => {
    if (activeRide && activeRide.status === RideStatus.DRIVER_ASSIGNED) {
      navigate(`/tracking/${activeRide.id}`);
    }
  }, [activeRide, navigate]);

  const canProceed = !hasChildren
    ? false
    : step === 1
      ? Boolean(formData.childId)
      : step === 2
        ? Boolean(trimmedPickup && trimmedDropoff)
        : true;

  const handleNext = () => {
    if (!hasChildren) {
      navigate('/add-child');
      return;
    }

    if (!canProceed) {
      return;
    }

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    void startDriverSearch();
  };

  const startDriverSearch = async () => {
    if (!formData.childId || !trimmedPickup || !trimmedDropoff) {
      return;
    }

    setIsSearching(true);
    setSearchStatus('Broadcasting to verified drivers...');

    const newRide: Ride = {
      id: `ride-${Date.now()}`,
      childId: formData.childId,
      pickupLocation: trimmedPickup,
      dropoffLocation: trimmedDropoff,
      pickupTime: new Date().toISOString(),
      status: RideStatus.SEARCHING_DRIVER,
      price: 0,
      tripCode: '',
      safeWord: '',
      serviceType: formData.serviceType as ServiceType,
      driverId: undefined
    };

    try {
      await requestRide(newRide);
    } catch (error) {
      console.error('Ride request failed:', error);
      setSearchStatus('Unable to reach ride service. Please try again.');
      setTimeout(() => setIsSearching(false), 1500);
      return;
    }

    const searchSequence = [
      { msg: 'Contacting verified drivers...', delay: 2000 },
      { msg: 'Waiting for acceptance...', delay: 4000 }
    ];

    searchSequence.forEach(({ msg, delay }) => {
      setTimeout(() => setSearchStatus(msg), delay);
    });
  };

  if (isSearching) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-8 p-6 text-center animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500 opacity-20 animate-ping" />
          <div className="absolute inset-[-20px] rounded-full bg-blue-500 opacity-10 animate-ping animation-delay-500" />

          <div className="relative z-10 rounded-full border-4 border-blue-50 bg-white p-6 shadow-xl">
            <Search size={48} className="text-[#3A77FF]" />
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Finding your ride</h2>
          <p className="h-6 font-medium text-[#3A77FF]">{searchStatus}</p>
        </div>

        <div className="w-full max-w-xs space-y-3 rounded-xl bg-gray-100 p-4 text-left">
          <div className="flex items-center gap-3">
            <ShieldCheck size={16} className="text-green-500" />
            <span className="text-xs text-gray-600">Request sent to nearby drivers</span>
          </div>
          <div className="flex items-center gap-3">
            <Map size={16} className="text-blue-500" />
            <span className="text-xs text-gray-600">Waiting for driver confirmation...</span>
          </div>
        </div>

        <div className="mt-8 max-w-[220px] text-xs text-gray-400">
          Tip: Open a second tab, sign in with a driver account, and accept this request.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold">Book a Ride</h2>
      </div>

      <div className="mb-8 flex gap-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className={`h-1.5 flex-1 rounded-full transition-colors ${item <= step ? 'bg-[#3A77FF]' : 'bg-gray-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6 fade-in">
          <h3 className="text-lg font-semibold">Who is this ride for?</h3>
          {hasChildren ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {availableChildren.map((child) => (
                <div
                  key={child.id}
                  onClick={() => setFormData({ ...formData, childId: child.id })}
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all ${formData.childId === child.id ? 'border-[#3A77FF] bg-blue-50' : 'border-gray-100 bg-white'}`}
                >
                  {child.photoUrl ? (
                    <img src={child.photoUrl} alt={child.name} className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-lg font-semibold text-[#3A77FF]">
                      {childInitials(child.name)}
                    </div>
                  )}
                  <span className="text-sm font-medium">{child.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-blue-100 bg-blue-50">
              <div className="space-y-3 text-center">
                <h4 className="text-lg font-semibold text-gray-900">Add a child profile first</h4>
                <p className="text-sm text-gray-600">
                  KidRide now books only for real child profiles saved to your account.
                </p>
                <Button onClick={() => navigate('/add-child')} className="w-full sm:w-auto">
                  Add Child
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 fade-in">
          <h3 className="text-lg font-semibold">Where and when?</h3>
          <Input
            label="Pickup Location"
            placeholder="e.g. Home, 123 Maple St"
            value={formData.pickup}
            onChange={(e) => setFormData({ ...formData, pickup: e.target.value })}
          />
          <Input
            label="Drop-off Location"
            placeholder="e.g. Soccer Field"
            value={formData.dropoff}
            onChange={(e) => setFormData({ ...formData, dropoff: e.target.value })}
          />
          <Select
            label="Service Type"
            value={formData.serviceType}
            onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
          >
            <option value="pickup_only">Pickup Only (Driver drops off)</option>
            <option value="pickup_and_dropoff">Round Trip</option>
            <option value="stay_with_child_and_dropoff">Stay &amp; Supervise</option>
          </Select>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 fade-in">
          <h3 className="text-lg font-semibold">Review &amp; Confirm</h3>
          <Card className="border-gray-200 bg-gray-50">
            <div className="space-y-4">
              {selectedChild && (
                <div className="rounded-xl border border-white bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
                  Ride for <span className="font-semibold text-gray-900">{selectedChild.name}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white p-2 shadow-sm">
                  <MapPin size={20} className="text-[#3A77FF]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="font-medium">{trimmedPickup}</p>
                </div>
              </div>
              <div className="my-1 ml-5 h-4 w-0.5 bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white p-2 shadow-sm">
                  <MapPin size={20} className="text-[#26C281]" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Drop-off</p>
                  <p className="font-medium">{trimmedDropoff}</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between border-y border-gray-100 py-4">
            <span className="text-gray-600">Service Type</span>
            <span className="text-lg font-semibold text-gray-900">{serviceTypeLabels[formData.serviceType]}</span>
          </div>

          <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-yellow-800">
            Pricing is not configured in this build yet. Your ride request will still be created and matched with an available driver.
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white p-6 md:relative md:mt-8 md:border-none md:bg-transparent md:p-0">
        <div className="mx-auto w-full max-w-4xl">
          <Button onClick={handleNext} fullWidth disabled={isSearching || (hasChildren && !canProceed)}>
            {!hasChildren ? 'Add a Child First' : step === 3 ? 'Confirm & Book' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};
