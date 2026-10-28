import React, { useEffect, useRef, useState } from 'react';
import { useCancellationFeeNote } from '../utils/useCancellationFee';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, MessageCircle, Phone, Share2, Shield, ShieldCheck, X } from 'lucide-react';
import { LiveMap, RouteInfo } from '../components/LiveMap';
import { MapScreen } from '../components/MapScreen';
import { Button, ConfirmModal } from '../components/UIComponents';
import { RatingBadge, useDriverRating } from '../components/Ratings';
import { SafetyAlertNote, SosButton } from '../components/SafetyActions';
import { useRide } from '../contexts/RideContext';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest, getStoredToken } from '../services/api';
import { RideStatus } from '../types';

// Tracking, the way DoorDash and Uber do it: a status stepper, one headline
// that says what is happening and how long it will take, the driver card
// with Call, Message and Share, and a Safety sheet one tap away.

const STEPS: { status: RideStatus[]; label: string }[] = [
  { status: [RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER], label: 'Booked' },
  { status: [RideStatus.DRIVER_ASSIGNED, RideStatus.DRIVER_ARRIVED], label: 'On the way' },
  { status: [RideStatus.IN_PROGRESS], label: 'In the car' },
  { status: [RideStatus.COMPLETED], label: 'Dropped off' }
];

interface TrustedContact { id: string; name: string; phone: string; relationship?: string | null }

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'DR';
const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`;
const smsHref = (phone: string, body: string) => `sms:${phone.replace(/[^+\d]/g, '')}?&body=${encodeURIComponent(body)}`;

const RoundAction: React.FC<{ icon: React.ReactNode; label: string; href?: string; onClick?: () => void; disabled?: boolean }> = ({ icon, label, href, onClick, disabled }) => {
  const className = `flex flex-col items-center gap-1.5 text-caption font-semibold ${disabled ? 'text-muted/60' : 'text-ink'}`;
  const circle = <span className={`flex h-12 w-12 items-center justify-center rounded-full ${disabled ? 'bg-surface-2 text-muted/60' : 'bg-surface-2 text-ink'}`}>{icon}</span>;
  return href && !disabled
    ? <a href={href} className={className}>{circle}{label}</a>
    : <button type="button" onClick={onClick} disabled={disabled} className={className}>{circle}{label}</button>;
};

export const LiveTracking = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { activeRide, syncError, cancelRide, refreshActiveRide } = useRide();
  const { user } = useAuth();
  const [route, setRoute] = useState<RouteInfo>({});
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const feeNote = useCancellationFeeNote(activeRide?.id, confirmingCancel);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const driverRating = useDriverRating(activeRide?.driver?.id || activeRide?.driverId);

  // Poll faster while the parent is watching so the car keeps moving.
  const refresh = useRef(refreshActiveRide);
  refresh.current = refreshActiveRide;
  useEffect(() => { const timer = setInterval(() => void refresh.current(), 3000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    if (!safetyOpen) return;
    apiRequest<{ contacts: TrustedContact[] }>('/users/me/trusted-contacts', { token: getStoredToken() })
      .then((result) => setContacts(result.contacts || [])).catch(() => setContacts([]));
  }, [safetyOpen]);

  if (!activeRide || activeRide.id !== id) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-label text-muted">This ride is no longer active.</p>
        <Button onClick={() => navigate('/rides')} className="w-auto px-8">See your rides</Button>
      </div>
    );
  }

  const status = activeRide.status;
  const driver = activeRide.driver;
  const child = user?.children?.find((item) => item.id === activeRide.childId);
  const childName = child?.name.split(' ')[0] || 'Your child';
  const driverFirst = driver?.name.split(' ')[0] || 'Your driver';
  const searching = [RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER].includes(status);
  const onBoard = status === RideStatus.IN_PROGRESS;
  const arrived = status === RideStatus.DRIVER_ARRIVED;
  const finished = [RideStatus.COMPLETED, RideStatus.CANCELLED].includes(status);
  const stepIndex = Math.max(0, STEPS.findIndex((step) => step.status.includes(status)));
  const eta = activeRide.driverLocation ? route.driverEta : undefined;
  const vehicle = driver?.vehicle;
  const vehicleLine = [vehicle?.color, vehicle?.make, vehicle?.model].filter(Boolean).join(' ');

  const headline = status === RideStatus.CANCELLED ? 'This ride was cancelled'
    : status === RideStatus.COMPLETED ? `${childName} has arrived`
    : searching ? 'Finding a verified driver nearby'
    : arrived ? `${driverFirst} is at the pickup`
    : onBoard ? (eta ? `${childName} arrives in ${eta}` : `${childName} is in the car`)
    : eta ? `${driverFirst} arriving in ${eta}` : `${driverFirst} is on the way`;
  const subline = searching
    ? (activeRide.nearbyDrivers === 0 ? 'No drivers right next to the pickup yet; open to all drivers.' : typeof activeRide.nearbyDrivers === 'number' ? `${activeRide.nearbyDrivers} driver${activeRide.nearbyDrivers === 1 ? '' : 's'} near the pickup` : 'Your request is with nearby drivers.')
    : onBoard ? `Heading to ${activeRide.dropoffLocation}`
    : finished ? '' : `Pickup at ${activeRide.pickupLocation}${route.tripDuration ? ` · ${route.tripDuration} trip` : ''}`;

  const tripLink = `${window.location.origin}${window.location.pathname}#/tracking/${activeRide.id}`;
  const shareText = `${childName}'s KidRide trip: ${activeRide.pickupLocation} to ${activeRide.dropoffLocation}. Trip code ${activeRide.tripCode}.`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'KidRide trip', text: shareText, url: tripLink });
      else { await navigator.clipboard.writeText(`${shareText} ${tripLink}`); setShareNote('Trip details copied.'); }
    } catch { /* the person closed the share sheet */ }
  };

  const confirmCancel = async () => {
    setCancelling(true);
    try { await cancelRide(); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not cancel the ride.'); }
    finally { setCancelling(false); setConfirmingCancel(false); }
  };

  const stepper = (
    <ol className="flex items-center gap-1.5" aria-label="Trip progress">
      {STEPS.map((step, index) => {
        const done = index < stepIndex || status === RideStatus.COMPLETED;
        const current = index === stepIndex && !finished;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={`h-1.5 rounded-full ${done ? 'bg-brand-deep' : current ? 'bg-brand' : 'bg-line'}`} />
            <span className={`truncate text-caption ${current || done ? 'font-semibold text-ink' : 'text-muted'}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );

  const sheet = (
    <div className="space-y-5">
      {status !== RideStatus.CANCELLED && stepper}
      <div>
        <h2 className="text-title font-extrabold tracking-tight lg:text-headline">{headline}</h2>
        {subline && <p className="mt-1 text-label text-muted">{subline}</p>}
        {(syncError || actionError) && <p className="mt-2 text-label text-warning">{actionError || syncError}</p>}
      </div>
      {!finished && <SafetyAlertNote alert={activeRide.safetyAlert} driverName={driverFirst} />}

      {driver ? (
        <div className="rounded-card border border-line bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="relative shrink-0">
              {driver.photoUrl
                ? <img src={driver.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
                : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-label font-bold text-brand-deep">{initials(driver.name)}</span>}
              {driver.isVerifiedDriver && <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-deep text-white"><Check size={11} strokeWidth={3} /></span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-bold">{driver.name}</span>
              <RatingBadge summary={driverRating} className="mt-0.5" />
              {vehicleLine && <span className="block truncate text-label text-muted">{vehicleLine}</span>}
            </span>
            {vehicle?.plate && <span className="rounded-control border border-line bg-surface px-2.5 py-1.5 font-mono text-label font-bold tracking-wider">{vehicle.plate}</span>}
          </div>
          <div className="mt-4 flex items-start justify-around border-t border-line pt-4">
            <RoundAction icon={<Phone size={20} />} label="Call" href={driver.phone ? telHref(driver.phone) : undefined} disabled={!driver.phone} />
            <RoundAction icon={<MessageCircle size={20} />} label="Message" href={driver.phone ? smsHref(driver.phone, `Hi ${driverFirst}, this is ${childName}'s parent.`) : undefined} disabled={!driver.phone} />
            <RoundAction icon={<Share2 size={20} />} label="Share" onClick={() => void share()} />
            <RoundAction icon={<Shield size={20} />} label="Safety" onClick={() => setSafetyOpen(true)} />
          </div>
          {shareNote && <p className="mt-2 text-center text-caption text-muted">{shareNote}</p>}
        </div>
      ) : (
        <div className="flex items-start justify-around rounded-card border border-line bg-white p-4">
          <RoundAction icon={<Share2 size={20} />} label="Share" onClick={() => void share()} />
          <RoundAction icon={<Shield size={20} />} label="Safety" onClick={() => setSafetyOpen(true)} />
        </div>
      )}

      <div className="flex items-center justify-between rounded-card bg-accent/15 px-4 py-3">
        <span>
          <span className="block text-caption font-semibold text-muted">Trip code{activeRide.tripCodeVerified ? ' · checked' : ''}</span>
          <span className="block text-caption text-muted">{activeRide.tripCodeVerified ? `${driverFirst} entered the right code` : `Give it to ${driverFirst} at pickup; they say the safe word`}</span>
        </span>
        <span className="text-right">
          <span className="block text-title font-extrabold tabular-nums tracking-wider">{activeRide.tripCode || '····'}</span>
          <span className="block text-caption font-semibold">{activeRide.safeWord || 'Pending'}</span>
        </span>
      </div>

      {!onBoard && !finished && (
        <button type="button" onClick={() => setConfirmingCancel(true)} className="w-full text-center text-label font-semibold text-danger">Cancel ride</button>
      )}
      {finished && <Button fullWidth onClick={() => navigate(status === RideStatus.COMPLETED ? '/rides' : '/dashboard')}>{status === RideStatus.COMPLETED ? 'Rate the ride' : 'Back to home'}</Button>}

      <ConfirmModal open={confirmingCancel} title="Cancel this ride?" body={`The trip will be cancelled for you and the driver. ${feeNote}`} confirmLabel="Cancel ride" tone="danger" busy={cancelling} onConfirm={() => void confirmCancel()} onClose={() => setConfirmingCancel(false)} />
    </div>
  );

  const safetySheet = safetyOpen && (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="safety-title">
      <div className="absolute inset-0 bg-ink/40" onClick={() => setSafetyOpen(false)} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-sheet bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-float lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[400px] lg:rounded-sheet">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line lg:hidden" />
        <div className="flex items-center justify-between">
          <h3 id="safety-title" className="text-title font-extrabold tracking-tight">Safety</h3>
          <button type="button" onClick={() => setSafetyOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="Close"><X size={20} /></button>
        </div>
        <a href="tel:911" className="mt-4 flex h-button items-center justify-center gap-2 rounded-full bg-danger text-body font-semibold text-white"><Phone size={18} /> Call emergency services</a>
        {!finished && <SosButton rideId={activeRide.id} who="parent" onSent={() => void refreshActiveRide()} className="mt-3" />}
        <div className="mt-5 divide-y divide-line">
          <button type="button" onClick={() => void share()} className="flex w-full items-center gap-3 py-3.5 text-left">
            <Share2 size={20} className="text-brand-deep" />
            <span className="flex-1"><span className="block text-label font-semibold">Share live trip</span><span className="block text-caption text-muted">Send the trip link and code to someone you trust</span></span>
          </button>
          <div className="py-3.5">
            <p className="text-label font-semibold">Trusted contacts</p>
            {contacts.length === 0
              ? <p className="mt-1 text-caption text-muted">None yet. Add them under Safety so they are one tap away.</p>
              : <ul className="mt-2 space-y-2">{contacts.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0"><span className="block truncate text-label">{contact.name}</span>{contact.relationship && <span className="block text-caption text-muted">{contact.relationship}</span>}</span>
                    <a href={telHref(contact.phone)} className="rounded-full border border-line px-3 py-1.5 text-caption font-semibold text-brand-deep">Call</a>
                  </li>
                ))}</ul>}
          </div>
          {driver && (
            <div className="flex items-start gap-3 py-3.5">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-success" />
              <span><span className="block text-label font-semibold">{driver.isVerifiedDriver ? `${driverFirst} is a verified driver` : `${driverFirst}'s verification`}</span><span className="block text-caption text-muted">Identity and documents checked by KidRide before their first ride.{vehicle?.plate ? ` Plate ${vehicle.plate}.` : ''}</span></span>
            </div>
          )}
          <div className="py-3.5">
            <p className="text-label font-semibold">Before {childName} gets in</p>
            <p className="mt-1 text-caption text-muted">Check the plate matches and the driver says the safe word <span className="font-semibold text-ink">{activeRide.safeWord}</span>. Then give them the trip code <span className="font-semibold text-ink">{activeRide.tripCode}</span>; they cannot start the trip without it.</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <MapScreen
        map={
          <LiveMap
            pickup={activeRide.pickupLocation}
            dropoff={activeRide.dropoffLocation}
            pickupCoords={activeRide.pickupCoords}
            dropoffCoords={activeRide.dropoffCoords}
            driverLocation={activeRide.driverLocation}
            nextStop={onBoard ? 'dropoff' : 'pickup'}
            pickupLabel={`Pickup · ${childName}`}
            onRoute={setRoute}
            className="h-full rounded-none"
            controlsClassName="right-3 top-4 lg:bottom-6 lg:top-auto"
            noticeClassName="left-16 right-16 top-4 lg:bottom-4 lg:left-3 lg:right-20 lg:top-auto"
          />
        }
        overlay={
          <button type="button" onClick={() => navigate('/dashboard')} className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-float" aria-label="Back to home"><X size={20} /></button>
        }
        sheetClassName="max-h-[64%]"
      >
        {sheet}
      </MapScreen>
      {safetySheet}
    </>
  );
};
