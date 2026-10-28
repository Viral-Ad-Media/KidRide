import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, Plus, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRide } from '../contexts/RideContext';
import { BookingMap } from '../components/BookingMap';
import { MapScreen } from '../components/MapScreen';
import { StatusChip } from '../components/UIComponents';
import { fetchScheduledRides, formatScheduledTime } from '../services/scheduledRides';
import { Child, Ride } from '../types';

// Parent home, the way Uber and Bolt open: the map, "Who is riding?" child
// chips, one "Where to?" box, and the next ride if there is one. Everything
// else lives behind the tabs.

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'C';

export const ChildChip: React.FC<{ child: Child; selected: boolean; onClick: () => void }> = ({ child, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-label font-semibold transition-colors ${selected ? 'border-accent bg-accent text-ink' : 'border-line bg-white text-ink hover:border-ink/30'}`}
  >
    {child.photoUrl
      ? <img src={child.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      : <span className={`flex h-8 w-8 items-center justify-center rounded-full text-caption font-bold ${selected ? 'bg-ink text-accent' : 'bg-surface-2 text-brand-deep'}`}>{initials(child.name)}</span>}
    {child.name.split(' ')[0]}
  </button>
);

export const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeRide } = useRide();
  const children = user?.children || [];
  const [childId, setChildId] = useState(children[0]?.id || '');
  const [upcoming, setUpcoming] = useState<Ride[]>([]);

  useEffect(() => { if (!children.some((child) => child.id === childId)) setChildId(children[0]?.id || ''); }, [children.length]);
  useEffect(() => { fetchScheduledRides().then((rides) => setUpcoming(rides.slice(0, 2))).catch(() => setUpcoming([])); }, [user?.id, activeRide?.status]);

  const firstName = user?.name.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const startBooking = (later = false) => {
    if (!children.length) { navigate('/add-child'); return; }
    const query = new URLSearchParams();
    if (childId) query.set('child', childId);
    if (later) query.set('when', 'later');
    navigate(`/book${query.toString() ? `?${query}` : ''}`);
  };

  const sheet = (
    <div className="space-y-5">
      <div>
        <h2 className="text-title font-extrabold tracking-tight lg:text-headline">{greeting}, {firstName}.</h2>
      </div>

      {activeRide && (
        <button type="button" onClick={() => navigate(`/tracking/${activeRide.id}`)} className="flex w-full items-center gap-3 rounded-card border border-brand bg-brand/10 px-4 py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><StatusChip status={activeRide.status} /></span>
            <span className="mt-1 block truncate text-label text-ink">{activeRide.pickupLocation} <ArrowRight size={12} className="inline" /> {activeRide.dropoffLocation}</span>
          </span>
          <span className="text-label font-semibold text-brand-deep">Track</span>
        </button>
      )}

      <div>
        <p className="mb-2 text-label font-semibold text-muted">Who is riding?</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          {children.map((child) => <ChildChip key={child.id} child={child} selected={child.id === childId} onClick={() => setChildId(child.id)} />)}
          <button type="button" onClick={() => navigate('/add-child')} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-label font-semibold text-muted hover:border-ink/30 hover:text-ink">
            <Plus size={16} /> {children.length ? 'Add' : 'Add a child'}
          </button>
        </div>
      </div>

      <div className="flex h-button w-full items-center gap-2 rounded-full bg-surface-2 pl-4 pr-1.5 text-body text-muted">
        <button type="button" onClick={() => startBooking()} className="flex h-full min-w-0 flex-1 items-center gap-3 text-left">
          <Search size={20} className="text-ink" />
          <span className="truncate font-medium">{children.length ? 'Where to?' : 'Add a child to book a ride'}</span>
        </button>
        {children.length > 0 && (
          <button type="button" onClick={() => startBooking(true)} className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-caption font-semibold text-ink hover:bg-line/40">
            <CalendarClock size={14} /> Later
          </button>
        )}
      </div>

      {upcoming.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-label font-semibold text-muted">Upcoming</p>
            <button type="button" onClick={() => navigate('/rides')} className="text-label font-semibold text-brand-deep">All rides</button>
          </div>
          <ul className="divide-y divide-line rounded-card border border-line bg-white">
            {upcoming.map((ride) => (
              <li key={ride.id}>
                <button type="button" onClick={() => navigate('/rides')} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-ink"><CalendarClock size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-label font-semibold">{formatScheduledTime(ride.pickupTime)}</span>
                    <span className="block truncate text-caption text-muted">{ride.pickupLocation} to {ride.dropoffLocation}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <MapScreen map={<BookingMap padding={{ top: 80, right: 40, bottom: 120, left: 40 }} />} sheetClassName="max-h-[70%]">
      {sheet}
    </MapScreen>
  );
};
