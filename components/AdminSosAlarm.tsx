import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, Phone, Siren } from 'lucide-react';
import { IncidentWithRide, fetchAllIncidents } from '../services/adminApi';

// Shown on every admin page (it sits under the admin tabs). Polls open SOS
// alerts every 10 seconds; a new one sounds an alarm that repeats until an admin
// acknowledges it, and flashes the tab title. The red bar stays until support
// marks the ride's incidents handled.

const POLL_MS = 10000;
const SEEN_KEY = 'kidride.admin.sosAcknowledged';

const readSeen = (): Set<string> => {
  try { return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
};
const saveSeen = (ids: Set<string>) => {
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-200))); } catch { /* private mode */ }
};

let audioContext: AudioContext | null = null;
// Two-tone siren, about a second long, made with Web Audio so no file is needed.
const playAlarm = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioContext = audioContext || new Ctx();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const start = audioContext.currentTime;
    [880, 660, 880, 660].forEach((frequency, i) => {
      const osc = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      osc.type = 'square';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.08, start + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.25 + 0.24);
      osc.connect(gain).connect(audioContext!.destination);
      osc.start(start + i * 0.25);
      osc.stop(start + i * 0.25 + 0.25);
    });
  } catch { /* audio blocked until the admin interacts with the page */ }
};

const minutesAgo = (iso: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes < 1 ? 'just now' : `${minutes} min ago`;
};

export const AdminSosAlarm: React.FC = () => {
  const [open, setOpen] = useState<IncidentWithRide[]>([]);
  const [unacknowledged, setUnacknowledged] = useState<string[]>([]);
  const seen = useRef<Set<string>>(readSeen());

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const incidents = await fetchAllIncidents('open', 'sos');
        if (stopped) return;
        setOpen(incidents);
        setUnacknowledged(incidents.map((i) => i.id).filter((id) => !seen.current.has(id)));
      } catch { /* keep the last list; the next poll retries */ }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  // Sound on each poll while there is an SOS nobody has acknowledged.
  useEffect(() => {
    if (!unacknowledged.length) return undefined;
    playAlarm();
    const original = document.title;
    let flip = false;
    const timer = window.setInterval(() => {
      flip = !flip;
      document.title = flip ? 'SOS ALERT · KidRide' : original;
    }, 1000);
    const repeat = window.setInterval(playAlarm, POLL_MS);
    return () => { window.clearInterval(timer); window.clearInterval(repeat); document.title = original; };
  }, [unacknowledged.join(',')]);

  const acknowledge = () => {
    unacknowledged.forEach((id) => seen.current.add(id));
    saveSeen(seen.current);
    setUnacknowledged([]);
  };

  if (!open.length) return null;
  return (
    <div role="alert" className="mb-5 rounded-card bg-danger p-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-body font-bold"><Siren size={20} className={unacknowledged.length ? 'animate-pulse' : ''} /> {open.length} open SOS {open.length === 1 ? 'alert' : 'alerts'}</p>
        {unacknowledged.length > 0 && (
          <button type="button" onClick={acknowledge} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-danger">
            <BellOff size={16} /> Acknowledge and silence
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {open.slice(0, 5).map((incident) => (
          <li key={incident.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white/10 px-3 py-2">
            <span className="font-semibold">{incident.ride?.child ? `${incident.ride.child.split(' ')[0]}'s ride` : 'Ride'} · by the {incident.reporterRole || 'user'} · {minutesAgo(incident.createdAt)}</span>
            {incident.ride?.parent?.phone && <a href={`tel:${incident.ride.parent.phone}`} className="inline-flex items-center gap-1 underline"><Phone size={14} /> Parent</a>}
            {incident.ride?.driver?.phone && <a href={`tel:${incident.ride.driver.phone}`} className="inline-flex items-center gap-1 underline"><Phone size={14} /> Driver</a>}
            {incident.location && <a href={`https://www.google.com/maps?q=${incident.location.latitude},${incident.location.longitude}`} target="_blank" rel="noreferrer noopener" className="underline">Map</a>}
            <Link to="/admin/rides" className="underline">Open in Rides</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
