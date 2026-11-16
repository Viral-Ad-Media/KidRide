import React from 'react';
import { Ride, RideStop } from '../types';
import { joinNames } from '../utils/rideData';

// The ride's route as a vertical line: pickup, each extra stop in order, drop-off.
// Done places are struck through; the place the car is heading to (or waiting at)
// is bold. Used by the driver console and by parents on the tracking screen.

const clock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

/** First names of the children who get out at a stop. */
export const stopRiders = (ride: Ride, stop: RideStop, accountChildren: { id: string; name: string }[] = []) => {
  const names = new Map([...accountChildren, ...(ride.children || [])].map((child) => [child.id, child.name.trim().split(/\s+/)[0]]));
  return joinNames(stop.childIds.map((id) => names.get(id) || '').filter(Boolean));
};

/** The stop the car is heading to or waiting at, or undefined when every stop is done. */
export const currentStop = (ride: Ride) => (ride.stops || []).find((stop) => stop.status !== 'done');

interface RideStopsProps {
  ride: Ride;
  /** The children are in the car, so the pickup is done. */
  pickupDone: boolean;
  accountChildren?: { id: string; name: string }[];
  className?: string;
}

export const RideStops: React.FC<RideStopsProps> = ({ ride, pickupDone, accountChildren, className = '' }) => {
  const stops = ride.stops || [];
  const next = currentStop(ride);
  const atDropoff = pickupDone && !next;
  const Row: React.FC<{ marker: React.ReactNode; title: string; note?: string; done?: boolean; active?: boolean; last?: boolean }> = ({ marker, title, note, done, active, last }) => (
    <li className="grid grid-cols-[22px_1fr] gap-x-3">
      <span className="flex flex-col items-center">
        {marker}
        {!last && <span className="my-1 w-0.5 flex-1 bg-line" />}
      </span>
      <span className={`min-w-0 ${last ? '' : 'pb-3'}`}>
        <span className={`block text-body ${done ? 'text-muted line-through' : active ? 'font-bold' : 'font-semibold'}`}>{title}</span>
        {note && <span className="block text-caption text-muted">{note}</span>}
      </span>
    </li>
  );
  return (
    <ol className={className} aria-label="Route">
      <Row marker={<span className="mt-1 h-3.5 w-3.5 rounded-full border-[3px] border-accent bg-white" />} title={ride.pickupLocation} note="Pickup" done={pickupDone} active={!pickupDone} />
      {stops.map((stop) => {
        const who = stopRiders(ride, stop, accountChildren);
        const state = stop.status === 'done' ? `Done ${clock(stop.completedAt)}` : stop.status === 'arrived' ? `Arrived ${clock(stop.arrivedAt)}` : pickupDone && stop === next ? 'Next stop' : '';
        return (
          <Row key={stop.index}
            marker={<span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 text-[11px] font-extrabold ${stop.status === 'done' ? 'border-line bg-line text-muted' : 'border-ink bg-white text-ink'}`}>{stop.index + 1}</span>}
            title={stop.address}
            note={[`Stop ${stop.index + 1}`, who && `${who} get${stop.childIds.length > 1 ? '' : 's'} out`, state].filter(Boolean).join(' · ')}
            done={stop.status === 'done'} active={pickupDone && stop === next} />
        );
      })}
      <Row marker={<span className="mt-1 h-3.5 w-3.5 rounded-full bg-ink" />} title={ride.dropoffLocation} note="Drop-off" active={atDropoff} last />
    </ol>
  );
};
