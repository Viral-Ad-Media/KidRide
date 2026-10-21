import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Select } from '../components/UIComponents';
import { ArrowLeft, CalendarClock, CheckCircle, MapPin, Search, ShieldCheck, Map, Zap } from 'lucide-react';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest, getStoredToken } from '../services/api';
import { RideStatus, ServiceType, Ride, PlaceCoords } from '../types';
import { PlacesInput } from '../components/PlacesInput';
import { bookScheduledRide, firstSlot, formatScheduledTime, latestSlot, toLocalInputValue, validateScheduleInput } from '../services/scheduledRides';

const childInitials = (name: string) => (
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'C'
);

const serviceTypeLabels: Record<string, string> = {
  pickup_only: 'Pickup only',
  dropoff_only: 'Drop-off only',
  pickup_and_dropoff: 'Pickup and drop-off',
  stay_with_child_and_dropoff: 'Stay with child, then drop-off'
};

const serviceTypeDescriptions: Record<string, string> = {
  pickup_only: 'The driver collects your child from the pickup address and brings them to you.',
  dropoff_only: 'The driver takes your child from you to the drop-off address.',
  pickup_and_dropoff: 'The driver collects your child and takes them to the drop-off address.',
  stay_with_child_and_dropoff: 'The driver stays with your child at the activity, then drops them off.'
};

const formatPrice = (price?: number) => (typeof price === 'number' ? `$${price.toFixed(2)}` : null);

export const BookRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestRide, activeRide, syncError } = useRide();
  const [quote, setQuote] = useState<number | null>(null);
  const [quoteService, setQuoteService] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    apiRequest<{ prices: Record<string, number> }>('/rides/prices', { token: getStoredToken() })
      .then((result) => setPrices(result.prices || {}))
      .catch(() => setPrices({}));
  }, []);
  const [step, setStep] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  // Now, or a pickup time chosen in local time (sent as UTC).
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduleValue, setScheduleValue] = useState(() => toLocalInputValue(firstSlot()));
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduledRide, setScheduledRide] = useState<Ride | null>(null);
  const scheduleProblem = when === 'later' ? validateScheduleInput(scheduleValue) : null;
  const availableChildren = user?.children || [];
  const hasChildren = availableChildren.length > 0;

  const [formData, setFormData] = useState({
    childId: '',
    pickup: '',
    dropoff: '',
    // Set only when the address comes from a suggestion; typing clears it.
    pickupCoords: null as PlaceCoords | null,
    dropoffCoords: null as PlaceCoords | null,
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

  // After booking for now, follow the ride once a driver takes it.
  useEffect(() => {
    if (isSearching && activeRide && [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS].includes(activeRide.status)) {
      navigate(`/tracking/${activeRide.id}`);
    }
  }, [activeRide, navigate, isSearching]);

  const canProceed = !hasChildren
    ? false
    : step === 1
      ? Boolean(formData.childId)
      : step === 2
        ? Boolean(trimmedPickup && trimmedDropoff) && !scheduleProblem
        : true;

  const handleNext = () => {
    if (!hasChildren) {
      navigate('/add-child');
      return;
    }

    if (!canProceed) {
      return;
    }

    if (step === 2) {
      setQuote(null); setQuoteError(null);
      void apiRequest<{ price: number }>('/rides/quote', { method: 'POST', token: getStoredToken(), body: { serviceType: formData.serviceType } }).then(result => { setQuote(result.price); setQuoteService(formData.serviceType); setStep(3); }).catch(err => setQuoteError(err.message));
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    if (when === 'later') void scheduleRide();
    else void startDriverSearch();
  };

  const scheduleRide = async () => {
    if (quote === null || quoteService !== formData.serviceType) return;
    const problem = validateScheduleInput(scheduleValue);
    if (problem) { setScheduleError(problem); setStep(2); return; }
    setIsScheduling(true);
    setScheduleError(null);
    try {
      const booked = await bookScheduledRide({
        id: '',
        childId: formData.childId,
        pickupLocation: trimmedPickup,
        dropoffLocation: trimmedDropoff,
        pickupCoords: formData.pickupCoords,
        dropoffCoords: formData.dropoffCoords,
        pickupTime: new Date(scheduleValue).toISOString(),
        status: RideStatus.SEARCHING_DRIVER,
        price: quote,
        tripCode: '',
        safeWord: '',
        serviceType: formData.serviceType as ServiceType
      });
      setScheduledRide(booked);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Could not schedule this ride. Please try again.');
    } finally {
      setIsScheduling(false);
    }
  };

  const startDriverSearch = async () => {
    if (!formData.childId || !trimmedPickup || !trimmedDropoff) {
      return;
    }

    if (quote === null || quoteService !== formData.serviceType) return;
    setIsSearching(true);
    setSearchStatus('Broadcasting to verified drivers...');

    const newRide: Ride = {
      id: `ride-${Date.now()}`,
      childId: formData.childId,
      pickupLocation: trimmedPickup,
      dropoffLocation: trimmedDropoff,
      pickupCoords: formData.pickupCoords,
      dropoffCoords: formData.dropoffCoords,
      pickupTime: new Date().toISOString(),
      status: RideStatus.SEARCHING_DRIVER,
      price: quote,
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

  if (scheduledRide) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center space-y-6 p-6 text-center fade-in">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Ride scheduled</h2>
          <p className="mt-2 text-lg font-semibold text-brand-deep">{formatScheduledTime(scheduledRide.pickupTime)}</p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            We start offering it to the nearest verified drivers 30 minutes before pickup. You can change the time or cancel from your dashboard until then.
          </p>
        </div>
        <div className="w-full rounded-2xl bg-slate-50 p-4 text-left text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{scheduledRide.pickupLocation}</p>
          <p className="mt-1">to {scheduledRide.dropoffLocation}</p>
        </div>
        <Button fullWidth onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-8 p-6 text-center animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-brand-deep opacity-20 animate-ping" />
          <div className="absolute inset-[-20px] rounded-full bg-brand-deep opacity-10 animate-ping animation-delay-500" />

          <div className="relative z-10 rounded-full border-4 border-brand/30 bg-white p-6 shadow-xl">
            <Search size={48} className="text-brand-deep" />
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Finding your ride</h2>
          <p className="h-6 font-medium text-brand-deep">{searchStatus}</p>
          {activeRide && activeRide.nearbyDrivers !== null && activeRide.nearbyDrivers !== undefined && (
            <p className="mt-3 text-sm text-slate-500">
              {activeRide.nearbyDrivers === 0
                ? 'No drivers near the pickup right now. Your request is open to all drivers.'
                : `${activeRide.nearbyDrivers} driver${activeRide.nearbyDrivers === 1 ? '' : 's'} near the pickup. Offering to the nearest first.`}
            </p>
          )}
        </div>

        <div className="w-full max-w-xs space-y-3 rounded-xl bg-gray-100 p-4 text-left">
          <div className="flex items-center gap-3">
            <ShieldCheck size={16} className="text-green-500" />
            <span className="text-xs text-gray-600">Request sent to nearby drivers</span>
          </div>
          <div className="flex items-center gap-3">
            <Map size={16} className="text-brand-deep" />
            <span className="text-xs text-gray-600">Waiting for driver confirmation...</span>
          </div>
        </div>

        {/* The ride id only exists once the request call returns, which can take a few seconds. */}
        <Button disabled={!activeRide} onClick={() => activeRide && navigate(`/tracking/${activeRide.id}`)}>
          {activeRide ? 'View Request' : 'Sending request...'}
        </Button>
        <div className="mt-8 max-w-[220px] text-xs text-gray-400">
          {syncError || 'You can view or cancel your request while waiting.'}
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
        <span className="text-sm font-semibold text-muted">Step {step} of 3</span>
      </div>

      {quoteError && <p className="mb-4 text-red-600">{quoteError}</p>}
      {scheduleError && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{scheduleError}</p>}
      <div className="mb-8 flex gap-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className={`h-1.5 flex-1 rounded-full transition-colors ${item <= step ? 'bg-brand' : 'bg-gray-200'}`} />
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
                  className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all ${formData.childId === child.id ? 'border-brand bg-brand/10' : 'border-gray-100 bg-white'}`}
                >
                  {child.photoUrl ? (
                    <img src={child.photoUrl} alt={child.name} className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-lg font-semibold text-brand-deep">
                      {childInitials(child.name)}
                    </div>
                  )}
                  <span className="text-sm font-medium">{child.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-brand/30 bg-brand/10">
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
        // Raised so the address suggestion lists open above the Next button bar.
        <div className="relative z-20 space-y-6 fade-in">
          <h3 className="text-lg font-semibold">Where and when?</h3>
          <PlacesInput
            label="Pickup Location"
            placeholder="e.g. Home, 123 Maple St"
            value={formData.pickup}
            onChange={(text) => setFormData((current) => ({ ...current, pickup: text, pickupCoords: null }))}
            onSelect={({ address, coords }) => setFormData((current) => ({ ...current, pickup: address, pickupCoords: coords }))}
          />
          <PlacesInput
            label="Drop-off Location"
            placeholder="e.g. Soccer Field"
            value={formData.dropoff}
            onChange={(text) => setFormData((current) => ({ ...current, dropoff: text, dropoffCoords: null }))}
            onSelect={({ address, coords }) => setFormData((current) => ({ ...current, dropoff: address, dropoffCoords: coords }))}
          />
          <Select
            label="Service Type"
            value={formData.serviceType}
            onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
          >
            {Object.keys(serviceTypeLabels).map((type) => (
              <option key={type} value={type}>
                {serviceTypeLabels[type]}{formatPrice(prices[type]) ? ` - ${formatPrice(prices[type])}` : ''}
              </option>
            ))}
          </Select>
          <p className="-mt-2 text-sm text-slate-500">{serviceTypeDescriptions[formData.serviceType]}</p>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Pickup time</p>
            <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-slate-100 p-1" role="radiogroup" aria-label="Pickup time">
              {([['now', 'Now', Zap], ['later', 'Schedule', CalendarClock]] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={when === value}
                  onClick={() => { setWhen(value); setScheduleError(null); }}
                  className={`inline-flex items-center justify-center gap-2 rounded-[16px] py-3 text-sm font-semibold transition ${when === value ? 'bg-white text-brand-deep shadow' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            {when === 'later' && (
              <div className="mt-4">
                <Input
                  type="datetime-local"
                  aria-label="Pickup date and time"
                  value={scheduleValue}
                  min={toLocalInputValue(firstSlot(30))}
                  max={toLocalInputValue(latestSlot())}
                  step={300}
                  onChange={(event) => { setScheduleValue(event.target.value); setScheduleError(null); }}
                />
                <p className={`-mt-2 text-sm ${scheduleProblem ? 'text-red-600' : 'text-slate-500'}`}>
                  {scheduleProblem || `${formatScheduledTime(scheduleValue)} · in your local time. Between 30 minutes and 30 days ahead, in 5-minute steps.`}
                </p>
              </div>
            )}
          </div>
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
                  <MapPin size={20} className="text-brand-deep" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="font-medium">{trimmedPickup}</p>
                </div>
              </div>
              <div className="my-1 ml-5 h-4 w-0.5 bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-white p-2 shadow-sm">
                  <MapPin size={20} className="text-success" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Drop-off</p>
                  <p className="font-medium">{trimmedDropoff}</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-gray-600">Pickup</span>
            <span className="text-lg font-semibold text-gray-900">{when === 'later' ? formatScheduledTime(scheduleValue) : 'Now'}</span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <span className="text-gray-600">Service Type</span>
            <span className="text-lg font-semibold text-gray-900">{serviceTypeLabels[formData.serviceType]}</span>
          </div>

          <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-yellow-800">
            {quote !== null ? `Fixed service fare: $${quote.toFixed(2)}` : 'Quote unavailable'}
          </div>
        </div>
      )}

      {/* Sits above the phone tab bar; inline on larger screens. */}
      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-0 right-0 border-t border-line bg-white px-4 py-3 lg:relative lg:bottom-auto lg:mt-8 lg:border-none lg:bg-transparent lg:p-0">
        <div className="mx-auto w-full max-w-4xl">
          <Button onClick={handleNext} fullWidth disabled={isSearching || isScheduling || (step === 3 && quote === null) || (hasChildren && !canProceed)}>
            {!hasChildren ? 'Add a Child First' : step === 3 ? (when === 'later' ? (isScheduling ? 'Scheduling...' : 'Confirm & Schedule') : 'Confirm & Book') : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};
