import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Check, CheckCircle2, MapPin, Zap } from 'lucide-react';
import { Button, Input } from '../components/UIComponents';
import { BookingMap } from '../components/BookingMap';
import { MapScreen } from '../components/MapScreen';
import { PlacesInput } from '../components/PlacesInput';
import { ChildChip } from './ParentDashboard';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest, getStoredToken } from '../services/api';
import { FareBreakdown as Fare, PlaceCoords, Ride, RideStatus, ServiceType } from '../types';
import { FareBreakdown } from '../components/FareBreakdown';
import { formatMoney } from '../utils/rideData';
import { bookScheduledRide, firstSlot, formatScheduledTime, latestSlot, toLocalInputValue, validateScheduleInput } from '../services/scheduledRides';

// Booking as one sheet per question over the map, the way Uber and Bolt do
// it: who, where, when, which service, confirm. One pill button per sheet;
// the map shows the pins and route as the addresses are chosen.

type Step = 'child' | 'where' | 'when' | 'service' | 'confirm';
const ORDER: Step[] = ['child', 'where', 'when', 'service', 'confirm'];

const SERVICES: { type: ServiceType; label: string; note: string }[] = [
  { type: ServiceType.PICKUP, label: 'Pickup', note: 'Collected and brought to you' },
  { type: ServiceType.DROPOFF, label: 'Drop-off', note: 'Taken from you to the destination' },
  { type: ServiceType.BOTH, label: 'Pickup and drop-off', note: 'Door to door' },
  { type: ServiceType.STAY, label: 'Stay, then drop-off', note: 'Driver waits at the activity' }
];
const serviceLabel = (type: string) => SERVICES.find((service) => service.type === type)?.label || type;
const STAY_OPTIONS = [30, 45, 60, 90, 120, 180];
type Quote = Fare & { quoteToken: string; currency: string };

export const BookRide = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { requestRide, activeRide, syncError } = useRide();
  const children = user?.children || [];

  const presetChild = children.find((child) => child.id === params.get('child'))?.id || '';
  const [step, setStep] = useState<Step>(presetChild ? 'where' : 'child');
  const [childId, setChildId] = useState(presetChild || children[0]?.id || '');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState<PlaceCoords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<PlaceCoords | null>(null);
  const [when, setWhen] = useState<'now' | 'later'>(params.get('when') === 'later' ? 'later' : 'now');
  const [scheduleValue, setScheduleValue] = useState(() => toLocalInputValue(firstSlot()));
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.PICKUP);
  const [stayMinutes, setStayMinutes] = useState(60);
  const [quotes, setQuotes] = useState<Record<string, Quote> | null>(null);
  const [pricing, setPricing] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [scheduledRide, setScheduledRide] = useState<Ride | null>(null);

  const pickupIso = when === 'later' && !validateScheduleInput(scheduleValue) ? new Date(scheduleValue).toISOString() : null;
  // Server-side fares for every service over this route, priced as the parent reaches the service step.
  useEffect(() => {
    if (step !== 'service') return;
    let live = true;
    setQuotes(null); setPricing(true); setError(null);
    apiRequest<{ quotes: Record<string, Quote> }>('/rides/quotes', {
      method: 'POST', token: getStoredToken(),
      body: { pickup: pickup.trim(), dropoff: dropoff.trim(), pickupCoords, dropoffCoords, scheduled: when === 'later', pickupTime: pickupIso, stayMinutes }
    })
      .then((result) => { if (live) setQuotes(result.quotes); })
      .catch((err) => { if (live) setError(err instanceof Error ? err.message : 'Could not price this trip.'); })
      .finally(() => { if (live) setPricing(false); });
    return () => { live = false; };
  }, [step, pickup, dropoff, pickupCoords, dropoffCoords, when, pickupIso, stayMinutes]);
  const quote = quotes?.[serviceType] || null;

  // Follow the ride once a driver takes it.
  useEffect(() => {
    if (searching && activeRide && [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS].includes(activeRide.status)) navigate(`/tracking/${activeRide.id}`);
  }, [activeRide, searching]);

  const child = children.find((item) => item.id === childId);
  const childName = child?.name.split(' ')[0] || 'your child';
  const scheduleProblem = when === 'later' ? validateScheduleInput(scheduleValue) : null;
  const stepIndex = ORDER.indexOf(step);
  const canContinue = useMemo(() => {
    switch (step) {
      case 'child': return !!childId;
      case 'where': return !!pickup.trim() && !!dropoff.trim();
      case 'when': return !scheduleProblem;
      default: return quote !== null;
    }
  }, [step, childId, pickup, dropoff, scheduleProblem, serviceType, quote]);

  const back = () => (stepIndex > 0 && !(step === 'where' && presetChild) ? setStep(ORDER[stepIndex - 1]) : navigate(-1));

  const next = async () => {
    setError(null);
    if (step !== 'confirm') { setStep(ORDER[stepIndex + 1]); return; }
    if (quote === null) return;
    const ride: Ride = {
      id: '', childId, pickupLocation: pickup.trim(), dropoffLocation: dropoff.trim(), pickupCoords, dropoffCoords,
      pickupTime: pickupIso || new Date().toISOString(),
      status: RideStatus.SEARCHING_DRIVER, price: quote.total, quoteToken: quote.quoteToken, stayMinutes, tripCode: '', safeWord: '', serviceType
    };
    setBusy(true);
    try {
      if (when === 'later') setScheduledRide(await bookScheduledRide(ride));
      else { setSearching(true); await requestRide(ride); }
    } catch (err) {
      setSearching(false);
      setError(err instanceof Error ? err.message : 'Could not book this ride. Please try again.');
    } finally { setBusy(false); }
  };

  const Heading: React.FC<{ title: string; note?: string }> = ({ title, note }) => (
    <div className="mb-4 flex items-start gap-3">
      <button type="button" onClick={back} className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-2" aria-label="Back"><ArrowLeft size={20} /></button>
      <div className="min-w-0 pt-1">
        <h2 className="text-title font-extrabold tracking-tight">{title}</h2>
        {note && <p className="mt-0.5 text-label text-muted">{note}</p>}
      </div>
    </div>
  );

  const Progress = () => (
    <div className="mb-4 flex gap-1.5" aria-hidden="true">
      {ORDER.map((item, index) => <span key={item} className={`h-1 flex-1 rounded-full ${index <= stepIndex ? 'bg-brand' : 'bg-line'}`} />)}
    </div>
  );

  let sheet: React.ReactNode;
  let matching = false;

  if (scheduledRide) {
    sheet = (
      <div className="py-4 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 size={32} /></span>
        <h2 className="mt-4 text-title font-extrabold tracking-tight">{childName}'s ride is booked</h2>
        <p className="mt-1 text-lead font-semibold text-brand-deep">{formatScheduledTime(scheduledRide.pickupTime)}</p>
        <p className="mt-3 text-label text-muted">We offer it to the nearest verified drivers 30 minutes before pickup. Change the time or cancel from Rides until then.</p>
        <Button fullWidth className="mt-6" onClick={() => navigate('/dashboard')}>Done</Button>
      </div>
    );
  } else if (searching) {
    matching = true;
    sheet = (
      <div className="py-2 text-center">
        <span className="relative mx-auto flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/40" />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent text-ink"><MapPin size={22} /></span>
        </span>
        <h2 className="mt-4 text-title font-extrabold tracking-tight">Finding a verified driver nearby</h2>
        <p className="mt-2 text-label text-muted">
          {activeRide?.nearbyDrivers === 0 ? 'No drivers right next to the pickup yet; your request is open to all drivers.'
            : activeRide?.nearbyDrivers ? `${activeRide.nearbyDrivers} driver${activeRide.nearbyDrivers === 1 ? '' : 's'} near the pickup. Offering to the nearest first.`
            : 'Your request is going out to drivers near the pickup.'}
        </p>
        {syncError && <p className="mt-2 text-label text-danger">{syncError}</p>}
        <Button fullWidth variant="secondary" className="mt-6" disabled={!activeRide} onClick={() => activeRide && navigate(`/tracking/${activeRide.id}`)}>
          {activeRide ? 'View request' : 'Sending request...'}
        </Button>
      </div>
    );
  } else if (!children.length) {
    sheet = (
      <div className="py-4 text-center">
        <h2 className="text-title font-extrabold tracking-tight">Add a child first</h2>
        <p className="mt-2 text-label text-muted">Every ride is booked for a child on your account, so the driver knows exactly who they are collecting.</p>
        <Button fullWidth className="mt-6" onClick={() => navigate('/add-child')}>Add a child</Button>
      </div>
    );
  } else {
    sheet = (
      <div>
        <Progress />
        {step === 'child' && (
          <>
            <Heading title="Who is riding?" />
            <div className="flex flex-wrap gap-2">
              {children.map((item) => <ChildChip key={item.id} child={item} selected={item.id === childId} onClick={() => setChildId(item.id)} />)}
            </div>
          </>
        )}
        {step === 'where' && (
          <>
            <Heading title={`Where is ${childName} going?`} />
            <div className="relative z-20 space-y-1">
              <PlacesInput label="Pickup" placeholder="Home, school, an address" value={pickup} onChange={(text) => { setPickup(text); setPickupCoords(null); }} onSelect={({ address, coords }) => { setPickup(address); setPickupCoords(coords); }} />
              <PlacesInput label="Drop-off" placeholder="Where to?" value={dropoff} onChange={(text) => { setDropoff(text); setDropoffCoords(null); }} onSelect={({ address, coords }) => { setDropoff(address); setDropoffCoords(coords); }} />
            </div>
            {routeInfo && pickupCoords && dropoffCoords && <p className="text-label text-muted">About {routeInfo.duration}, {routeInfo.distance}.</p>}
          </>
        )}
        {step === 'when' && (
          <>
            <Heading title="When?" />
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pickup time">
              {([['now', 'Now', Zap, 'A driver heads over right away'], ['later', 'Later', CalendarClock, 'Up to 30 days ahead']] as const).map(([value, label, Icon, note]) => (
                <button key={value} type="button" role="radio" aria-checked={when === value} onClick={() => setWhen(value)} className={`rounded-card border p-4 text-left transition-colors ${when === value ? 'border-brand bg-brand/10' : 'border-line bg-white hover:border-ink/30'}`}>
                  <Icon size={22} className={when === value ? 'text-brand-deep' : 'text-muted'} />
                  <span className="mt-3 block text-body font-bold">{label}</span>
                  <span className="block text-caption text-muted">{note}</span>
                </button>
              ))}
            </div>
            {when === 'later' && (
              <div className="mt-4">
                <Input type="datetime-local" aria-label="Pickup date and time" value={scheduleValue} min={toLocalInputValue(firstSlot(30))} max={toLocalInputValue(latestSlot())} step={300} onChange={(event) => setScheduleValue(event.target.value)} />
                <p className={`-mt-2 text-label ${scheduleProblem ? 'text-danger' : 'text-muted'}`}>{scheduleProblem || formatScheduledTime(scheduleValue)}</p>
              </div>
            )}
          </>
        )}
        {step === 'service' && (
          <>
            <Heading title="What kind of ride?" />
            <ul className="space-y-2">
              {SERVICES.map((service) => {
                const selected = service.type === serviceType;
                return (
                  <li key={service.type}>
                    <button type="button" onClick={() => setServiceType(service.type)} aria-pressed={selected} className={`flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors ${selected ? 'border-brand bg-brand/10' : 'border-line bg-white hover:border-ink/30'}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-bold">{service.label}</span>
                        <span className="block text-caption text-muted">{service.note}</span>
                      </span>
                      <span className="text-body font-bold tabular-nums">{quotes?.[service.type] ? formatMoney(quotes[service.type].total, quotes[service.type].currency) : pricing ? '...' : ''}</span>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? 'border-brand-deep bg-brand-deep text-white' : 'border-line'}`}>{selected && <Check size={14} />}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {serviceType === ServiceType.STAY && (
              <label className="mt-3 flex items-center justify-between gap-3 text-label">
                <span className="text-muted">How long should the driver stay?</span>
                <select value={stayMinutes} onChange={(event) => setStayMinutes(Number(event.target.value))} className="rounded-full border border-line bg-white px-3 py-2 font-semibold">
                  {STAY_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ' 30' : ''}`}</option>)}
                </select>
              </label>
            )}
            {quote && quote.distanceSource !== 'none' && <p className="mt-3 text-caption text-muted">Priced for {quote.miles.toFixed(1)} mi, about {quote.minutes} min. The price is fixed when you book.</p>}
          </>
        )}
        {step === 'confirm' && (
          <>
            <Heading title="Confirm the ride" />
            <dl className="divide-y divide-line rounded-card border border-line bg-white">
              {([
                ['Rider', child?.name || ''],
                ['Pickup', pickup.trim()],
                ['Drop-off', dropoff.trim()],
                ['When', when === 'later' ? formatScheduledTime(scheduleValue) : 'Now'],
                ['Service', serviceLabel(serviceType)]
              ] as const).map(([label, value]) => (
                <div key={label} className="flex gap-4 px-4 py-3">
                  <dt className="w-20 shrink-0 text-label text-muted">{label}</dt>
                  <dd className="min-w-0 flex-1 text-label font-semibold">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-label text-muted">Fare</dt>
                <dd className="text-title font-extrabold tabular-nums">{quote ? formatMoney(quote.total, quote.currency) : ''}</dd>
              </div>
            </dl>
            {quote && <FareBreakdown fare={quote} currency={quote.currency} showTotal={false} className="mt-3 px-1" />}
          </>
        )}
        {error && <p className="mt-3 text-label text-danger">{error}</p>}
        <Button fullWidth className="mt-5" onClick={() => void next()} disabled={!canContinue || busy}>
          {step === 'confirm' ? (busy ? 'Booking...' : when === 'later' ? 'Book for later' : 'Book now') : step === 'service' ? (pricing ? 'Pricing...' : 'Continue') : 'Next'}
        </Button>
      </div>
    );
  }

  return (
    <MapScreen
      map={<BookingMap pickup={pickupCoords} dropoff={dropoffCoords} pickupLabel={`Pickup · ${childName}`} matching={matching} padding={{ top: 80, right: 40, bottom: 120, left: 40 }} onRoute={setRouteInfo} />}
      sheetClassName="max-h-[72%]"
    >
      {sheet}
    </MapScreen>
  );
};
