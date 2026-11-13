import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Check, CheckCircle2, MapPin, Repeat, Zap } from 'lucide-react';
import { Button, Input } from '../components/UIComponents';
import { BookingMap } from '../components/BookingMap';
import { MapScreen } from '../components/MapScreen';
import { PlacesInput } from '../components/PlacesInput';
import { geocodeAddress } from '../services/googleMaps';
import { ChildChip } from './ParentDashboard';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest, getStoredToken } from '../services/api';
import { FareBreakdown as Fare, MAX_CHILDREN_PER_RIDE, PlaceCoords, Ride, RideStatus, ServiceType } from '../types';
import { FareBreakdown } from '../components/FareBreakdown';
import { formatMoney, joinNames } from '../utils/rideData';
import { bookScheduledRide, firstSlot, formatScheduledTime, latestSlot, toLocalInputValue, validateScheduleInput } from '../services/scheduledRides';
import { RepeatPlanPicker } from '../components/RepeatingRides';
import { RideSeries, SCHOOL_DAYS, SeriesPlan, SeriesPreview, addDays, bookSeries, describeDays, formatClock, formatDay, planDays, previewSeries, validatePlan, ymd } from '../services/rideSeries';
import { CardSetup } from '../components/payments/CardSetup';
import { QuotePlan } from '../services/plans';
import { fetchPaymentConfig } from '../services/payments';

// Booking as one sheet per question over the map, the way Uber and Bolt do
// it: who (one or more children), where, when, which service, confirm. One pill button per sheet;
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

// Same check as the server: same address text, or points less than 150 m apart.
const samePlace = (a: string, b: string, from: PlaceCoords | null, to: PlaceCoords | null) => {
  const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm(a) && norm(a) === norm(b)) return true;
  if (!from || !to) return false;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(to.lat - from.lat) / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lng - from.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h)) < 150;
};

export const BookRide = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { requestRide, activeRide, syncError } = useRide();
  const children = user?.children || [];

  const presetChild = children.find((child) => child.id === params.get('child'))?.id || '';
  // With one child there is nothing to ask; with several, the who step lets the parent add brothers and sisters.
  const skipWho = !!presetChild && children.length === 1;
  const [step, setStep] = useState<Step>(skipWho ? 'where' : 'child');
  const [childIds, setChildIds] = useState<string[]>(() => [presetChild || children[0]?.id].filter(Boolean) as string[]);
  // Several children can share one car, up to MAX_CHILDREN_PER_RIDE; at least one stays picked.
  const toggleChild = (id: string) => setChildIds((current) => (
    current.includes(id) ? (current.length > 1 ? current.filter((item) => item !== id) : current)
      : current.length < MAX_CHILDREN_PER_RIDE ? [...current, id] : current
  ));
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState<PlaceCoords | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<PlaceCoords | null>(null);
  const [when, setWhen] = useState<'now' | 'later' | 'weekly'>(params.get('when') === 'later' ? 'later' : params.get('when') === 'weekly' ? 'weekly' : 'now');
  // Repeating school-week plan: weekdays, local pickup time, first and last day.
  const [plan, setPlan] = useState<SeriesPlan>(() => {
    const start = addDays(ymd(new Date()), 1);
    return { weekdays: SCHOOL_DAYS, pickupLocalTime: '07:45', startDate: start, endDate: addDays(start, 55) };
  });
  const [preview, setPreview] = useState<SeriesPreview | null>(null);
  const [bookedSeries, setBookedSeries] = useState<RideSeries | null>(null);
  const [scheduleValue, setScheduleValue] = useState(() => toLocalInputValue(firstSlot()));
  const [serviceType, setServiceType] = useState<ServiceType>(ServiceType.PICKUP);
  const [stayMinutes, setStayMinutes] = useState(60);
  const [quotes, setQuotes] = useState<Record<string, Quote> | null>(null);
  const [quotePlan, setQuotePlan] = useState<QuotePlan | null>(null);
  const [pricing, setPricing] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [scheduledRide, setScheduledRide] = useState<Ride | null>(null);
  // Card payments: when switched on, a saved card is needed to book.
  const [payment, setPayment] = useState<{ enabled: boolean; hasCard: boolean }>({ enabled: false, hasCard: false });
  useEffect(() => { fetchPaymentConfig().then((config) => setPayment({ enabled: config.enabled, hasCard: !!config.card })).catch(() => undefined); }, []);

  const planProblem = when === 'weekly' ? validatePlan(plan) : null;
  const firstDay = when === 'weekly' && !planProblem ? planDays(plan, new Date(), 1)[0] : null;
  // A repeating booking is quoted at its first ride; the confirm step shows each ride's own fare.
  const pickupIso = when === 'later' && !validateScheduleInput(scheduleValue) ? new Date(scheduleValue).toISOString()
    : firstDay ? firstDay.pickup.toISOString() : null;
  // Server-side fares for every service over this route, priced as the parent reaches the service step.
  useEffect(() => {
    if (step !== 'service') return;
    let live = true;
    setQuotes(null); setPricing(true); setError(null);
    apiRequest<{ quotes: Record<string, Quote>; plan?: QuotePlan }>('/rides/quotes', {
      method: 'POST', token: getStoredToken(),
      body: { pickup: pickup.trim(), dropoff: dropoff.trim(), pickupCoords, dropoffCoords, scheduled: when !== 'now', pickupTime: pickupIso, stayMinutes, childCount: childIds.length }
    })
      .then((result) => { if (live) { setQuotes(result.quotes); setQuotePlan(result.plan || null); } })
      .catch((err) => { if (live) setError(err instanceof Error ? err.message : 'Could not price this trip.'); })
      .finally(() => { if (live) setPricing(false); });
    return () => { live = false; };
  }, [step, pickup, dropoff, pickupCoords, dropoffCoords, when, pickupIso, stayMinutes, childIds.length]);
  const quote = quotes?.[serviceType] || null;
  const seriesTrip = () => ({ childIds, pickup: pickup.trim(), dropoff: dropoff.trim(), pickupCoords, dropoffCoords, serviceType, stayMinutes });
  // Every ride day and its own fare, before a repeating booking is made.
  useEffect(() => {
    if (step !== 'confirm' || when !== 'weekly' || planProblem) { setPreview(null); return; }
    let live = true;
    setPreview(null);
    previewSeries(seriesTrip(), plan)
      .then((result) => { if (live) setPreview(result); })
      .catch((err) => { if (live) setError(err instanceof Error ? err.message : 'Could not price these rides.'); });
    return () => { live = false; };
  }, [step, when, plan, serviceType, stayMinutes, pickup, dropoff, pickupCoords, dropoffCoords, childIds]);

  // Follow the ride once a driver takes it.
  useEffect(() => {
    if (searching && activeRide && [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED, RideStatus.IN_PROGRESS].includes(activeRide.status)) navigate(`/tracking/${activeRide.id}`);
  }, [activeRide, searching]);

  // Booking order, so the first child picked is the ride's main child.
  const riders = childIds.map((id) => children.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => !!item);
  const several = riders.length > 1;
  const childName = joinNames(riders.map((item) => item.name.split(' ')[0])) || 'your child';
  const scheduleProblem = when === 'later' ? validateScheduleInput(scheduleValue) : null;
  const stepIndex = ORDER.indexOf(step);
  const canContinue = useMemo(() => {
    switch (step) {
      case 'child': return riders.length > 0;
      case 'where': return !!pickup.trim() && !!dropoff.trim();
      case 'when': return when === 'weekly' ? !planProblem : !scheduleProblem;
      case 'confirm': return quote !== null && (!payment.enabled || payment.hasCard) && (when !== 'weekly' || (!!preview && preview.rideCount > 0));
      default: return quote !== null;
    }
  }, [step, riders.length, pickup, dropoff, scheduleProblem, planProblem, when, serviceType, quote, preview, payment]);

  const back = () => (stepIndex > 0 && !(step === 'where' && skipWho) ? setStep(ORDER[stepIndex - 1]) : navigate(-1));

  const next = async () => {
    setError(null);
    if (step === 'where') {
      // Typed addresses without a picked suggestion are looked up, so the trip is priced by
      // distance and drivers and route monitoring know where it is.
      let from = pickupCoords;
      let to = dropoffCoords;
      if (!from || !to) {
        setBusy(true);
        const [a, b] = await Promise.all([from ? null : geocodeAddress(pickup), to ? null : geocodeAddress(dropoff)]);
        setBusy(false);
        if (a) { from = a.coords; setPickupCoords(a.coords); setPickup(a.address); }
        if (b) { to = b.coords; setDropoffCoords(b.coords); setDropoff(b.address); }
        // null = no such address; undefined = Maps unavailable, so the booking goes ahead at the minimum fare.
        if ((!from && a === null) || (!to && b === null)) { setError('We could not find that address. Pick it from the suggestions so the trip can be priced and tracked.'); return; }
      }
      if (samePlace(pickup, dropoff, from, to)) { setError('Pickup and drop-off are the same place. Choose a different drop-off.'); return; }
    }
    if (step !== 'confirm') { setStep(ORDER[stepIndex + 1]); return; }
    if (quote === null) return;
    if (when === 'weekly') {
      setBusy(true);
      try { setBookedSeries(await bookSeries(seriesTrip(), plan)); }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not book these rides. Please try again.'); }
      finally { setBusy(false); }
      return;
    }
    const ride: Ride = {
      id: '', childId: riders[0].id, childIds: riders.map((item) => item.id), pickupLocation: pickup.trim(), dropoffLocation: dropoff.trim(), pickupCoords, dropoffCoords,
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

  if (bookedSeries) {
    sheet = (
      <div className="py-4 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><Repeat size={30} /></span>
        <h2 className="mt-4 text-title font-extrabold tracking-tight">Repeating rides booked for {childName}</h2>
        <p className="mt-1 text-lead font-semibold text-brand-deep">{describeDays(bookedSeries.weekdays)} at {formatClock(bookedSeries.pickupLocalTime)}</p>
        <p className="mt-1 text-label text-muted">{formatDay(bookedSeries.startDate)} to {formatDay(bookedSeries.endDate)}</p>
        <p className="mt-3 text-label text-muted">Each ride is booked a week ahead and offered to the nearest verified drivers 30 minutes before pickup. Skip a day or cancel the whole booking from Rides, Upcoming.</p>
        <Button fullWidth className="mt-6" onClick={() => navigate('/rides?tab=upcoming')}>See upcoming rides</Button>
        <Button fullWidth variant="secondary" className="mt-2" onClick={() => navigate('/dashboard')}>Done</Button>
      </div>
    );
  } else if (scheduledRide) {
    sheet = (
      <div className="py-4 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 size={32} /></span>
        <h2 className="mt-4 text-title font-extrabold tracking-tight">Ride booked for {childName}</h2>
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
            <Heading title="Who is riding?" note={children.length > 1 ? `Pick everyone going to the same place, up to ${MAX_CHILDREN_PER_RIDE}. One driver, one trip code.` : undefined} />
            <div className="flex flex-wrap gap-2">
              {children.map((item) => <ChildChip key={item.id} child={item} selected={childIds.includes(item.id)} onClick={() => toggleChild(item.id)} />)}
            </div>
            {several && <p className="mt-3 text-label text-muted">{riders.length} children in one car. Each child after the first adds a small extra-child fee, shown before you book.</p>}
          </>
        )}
        {step === 'where' && (
          <>
            <Heading title={`Where ${several ? 'are' : 'is'} ${childName} going?`} />
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
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Pickup time">
              {([['now', 'Now', Zap, 'A driver heads over right away'], ['later', 'Later', CalendarClock, 'One ride, up to 30 days ahead'], ['weekly', 'Every week', Repeat, 'School days on repeat']] as const).map(([value, label, Icon, note]) => (
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
            {when === 'weekly' && <RepeatPlanPicker plan={plan} onChange={setPlan} problem={planProblem} />}
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
            {quotePlan && (
              <p className="mt-3 rounded-card bg-surface-2 px-3 py-2 text-caption text-ink">
                {quotePlan.ridesLeftThisWeek > 0
                  ? `${quotePlan.name} plan: ${quotePlan.ridesLeftThisWeek} of ${quotePlan.ridesPerWeek} discounted rides left this week. Prices above include your discount.`
                  : `${quotePlan.name} plan: this week's ${quotePlan.ridesPerWeek} discounted rides are used, so this ride is the normal fare.`}
              </p>
            )}
            {quote && quote.distanceSource !== 'none' && <p className="mt-3 text-caption text-muted">Priced for {quote.miles.toFixed(1)} mi, about {quote.minutes} min. The price is fixed when you book.</p>}
          </>
        )}
        {step === 'confirm' && (
          <>
            <Heading title={when === 'weekly' ? 'Confirm the repeating rides' : 'Confirm the ride'} />
            <dl className="divide-y divide-line rounded-card border border-line bg-white">
              {([
                [several ? 'Riders' : 'Rider', joinNames(riders.map((item) => item.name))],
                ['Pickup', pickup.trim()],
                ['Drop-off', dropoff.trim()],
                ['When', when === 'weekly' ? `${describeDays(plan.weekdays)} at ${formatClock(plan.pickupLocalTime)}, ${formatDay(plan.startDate)} to ${formatDay(plan.endDate)}` : when === 'later' ? formatScheduledTime(scheduleValue) : 'Now'],
                ['Service', serviceLabel(serviceType)]
              ] as const).map(([label, value]) => (
                <div key={label} className="flex gap-4 px-4 py-3">
                  <dt className="w-20 shrink-0 text-label text-muted">{label}</dt>
                  <dd className="min-w-0 flex-1 text-label font-semibold">{value}</dd>
                </div>
              ))}
              {when === 'weekly' ? (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-label text-muted">Rides</dt>
                    <dd className="text-title font-extrabold tabular-nums">{preview ? preview.rideCount : '...'}</dd>
                  </div>
                  {preview && preview.rides.length > 0 && (
                    <ul className="mt-2 space-y-1 text-label" aria-label="First rides and their fares">
                      {preview.rides.slice(0, 5).map((ride) => (
                        <li key={ride.date} className="flex justify-between"><span>{formatDay(ride.date)}</span><span className="font-semibold tabular-nums">{formatMoney(ride.total, preview.currency)}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-label text-muted">Fare</dt>
                  <dd className="text-title font-extrabold tabular-nums">{quote ? formatMoney(quote.total, quote.currency) : ''}</dd>
                </div>
              )}
            </dl>
            {when === 'weekly'
              ? <p className="mt-3 px-1 text-caption text-muted">Each ride is priced and charged on its own, so a school-run peak day can cost a little more. Rides are booked a week ahead; skip a day or cancel any time from Rides.{quotePlan ? ' Your monthly plan discount is added to each ride, up to your weekly limit.' : ''}</p>
              : quote && <FareBreakdown fare={quote} currency={quote.currency} showTotal={false} className="mt-3 px-1" />}
            {payment.enabled && (
              <div className="mt-4 rounded-card border border-line bg-white p-4">
                <p className="mb-2 text-label font-semibold text-ink">Pay with</p>
                <CardSetup compact onChange={(card) => setPayment({ enabled: true, hasCard: !!card })} />
                <p className="mt-2 text-caption text-muted">The fare is held on your card when a driver accepts and charged after drop-off.</p>
              </div>
            )}
          </>
        )}
        {error && <p className="mt-3 text-label text-danger">{error}</p>}
        <Button fullWidth className="mt-5" onClick={() => void next()} disabled={!canContinue || busy}>
          {step === 'confirm' ? (busy ? 'Booking...' : when === 'weekly' ? `Book ${preview?.rideCount || ''} rides` : when === 'later' ? 'Book for later' : 'Book now') : step === 'service' ? (pricing ? 'Pricing...' : 'Continue') : 'Next'}
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
