import React, { useState } from 'react';
import { AlertTriangle, Copy, Phone, Siren } from 'lucide-react';
import { ConfirmModal } from './UIComponents';
import { apiRequest, getStoredToken } from '../services/api';
import { SafetyAlert } from '../types';

// SOS for the parent tracking a ride and the driver on one. It asks first, so a
// stray tap never alerts anyone, then sends the device position when the
// browser shares it (the server falls back to the driver's last GPS fix).

export const SAFETY_ALERT_LABELS: Record<SafetyAlert, string> = {
  sos: 'SOS raised',
  trip_code: 'Wrong trip code',
  off_route: 'Off route',
  stalled: 'Car stopped'
};

const currentPosition = () => new Promise<GeolocationPosition | null>((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 });
});

export const SosButton: React.FC<{ rideId: string; who: 'parent' | 'driver'; onSent?: () => void; className?: string }> = ({ rideId, who, onSent, className = '' }) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [contactsNotified, setContactsNotified] = useState(0);
  const [copied, setCopied] = useState(false);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const position = await currentPosition();
      const location = position ? { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } : undefined;
      const result = await apiRequest<{ liveUrl?: string; contactsNotified?: number }>(`/rides/${rideId}/sos`, { method: 'POST', token: getStoredToken(), body: { confirm: true, location } });
      setLiveUrl(result?.liveUrl || null);
      setContactsNotified(Number(result?.contactsNotified) || 0);
      setSentAt(new Date());
      setConfirming(false);
      onSent?.();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not send the SOS. Call 911 if anyone is in danger.');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!liveUrl) return;
    try { await navigator.clipboard.writeText(liveUrl); setCopied(true); } catch { window.prompt('Copy this live location link', liveUrl); }
  };
  const contactsText = contactsNotified ? ` ${contactsNotified} trusted contact${contactsNotified === 1 ? ' was' : 's were'} emailed a live location link.` : '';

  return (
    <div className={className}>
      {sentAt ? (
        <div role="status" className="rounded-card bg-danger/10 px-4 py-3 text-label text-danger">
          <p className="flex items-start gap-2 font-semibold">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>SOS sent at {sentAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. KidRide support has been alerted with your location.{who === 'parent' ? contactsText : ''}</span>
          </p>
          {who === 'parent' && liveUrl && (
            <button type="button" onClick={() => void copyLink()} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-ink underline">
              <Copy size={14} /> {copied ? 'Link copied' : 'Copy live location link to share'}
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="flex h-button w-full items-center justify-center gap-2 rounded-full border-2 border-danger bg-white text-body font-semibold text-danger hover:bg-danger/5">
          <Siren size={18} /> SOS: alert KidRide support
        </button>
      )}
      <a href="tel:911" className="mt-2 flex h-button w-full items-center justify-center gap-2 rounded-full bg-danger text-body font-semibold text-white hover:bg-danger/90">
        <Phone size={18} /> Call 911
      </a>
      <ConfirmModal
        open={confirming}
        title="Send an SOS?"
        body={who === 'parent'
          ? 'KidRide support gets an alert now with the time, this ride and your location, and will contact you and the driver. Trusted contacts with an email get a live location link. The driver is not told you pressed it. For immediate danger, call 911 first.'
          : 'KidRide support, the parent and the parent\'s trusted contacts get an alert now with the time, this ride and a live location link. For immediate danger, call 911 first.'}
        confirmLabel="Send SOS"
        tone="danger"
        busy={busy}
        error={error}
        onConfirm={() => void send()}
        onClose={() => { setConfirming(false); setError(null); }}
      />
    </div>
  );
};

// What the parent sees on tracking when the ride has an automatic alert.
export const SafetyAlertNote: React.FC<{ alert?: SafetyAlert | null; driverName: string }> = ({ alert, driverName }) => {
  if (!alert || alert === 'sos') return null;
  const text = alert === 'trip_code'
    ? `${driverName} entered a trip code that does not match. Only let your child in once the code matches.`
    : alert === 'off_route'
      ? `The car is away from the expected route. KidRide support has been alerted; you can call ${driverName} below.`
      : `The car has not moved for a while. KidRide support has been alerted; you can call ${driverName} below.`;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-card bg-warning/15 px-4 py-3 text-label text-ink">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />{text}
    </p>
  );
};
