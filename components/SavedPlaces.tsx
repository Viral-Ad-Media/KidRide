import React, { useState } from 'react';
import { GraduationCap, Home, MapPin, Music, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button, ConfirmModal, Input, Modal } from './UIComponents';
import { PlacesInput } from './PlacesInput';
import { PlaceCoords } from '../types';
import { PlaceKind, SavedPlace, addSavedPlace, guessKind, placeAt, removeSavedPlace, suggestLabel, updateSavedPlace, useSavedPlaces } from '../services/savedPlaces';

// Saved places: managed on Profile, picked with one tap when booking.

const KIND_ICON: Record<PlaceKind, React.ElementType> = { home: Home, school: GraduationCap, activity: Music, other: Star };
const KIND_LABEL: Record<PlaceKind, string> = { home: 'Home', school: 'School', activity: 'Activity', other: 'Other' };

export const PlaceIcon: React.FC<{ kind: PlaceKind; size?: number; className?: string }> = ({ kind, size = 16, className = '' }) => {
  const Icon = KIND_ICON[kind] || MapPin;
  return <Icon size={size} className={className} aria-hidden="true" />;
};

/** One-tap saved places under a booking address field. */
export const SavedPlaceChips: React.FC<{ places: SavedPlace[]; selectedId?: string | null; disabledId?: string | null; label: string; onPick: (place: SavedPlace) => void }> = ({ places, selectedId, disabledId, label, onPick }) => {
  if (!places.length) return null;
  return (
    <div className="-mt-2 mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label={`Saved places for ${label.toLowerCase()}`}>
      {places.map((place) => {
        const selected = place.id === selectedId;
        const disabled = place.id === disabledId;
        return (
          <button
            key={place.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            title={place.address}
            onClick={() => onPick(place)}
            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-label font-semibold transition-colors disabled:opacity-40 ${selected ? 'border-brand bg-brand/15 text-ink' : 'border-line bg-white text-ink hover:border-ink/30'}`}
          >
            <PlaceIcon kind={place.kind} size={15} className={selected ? 'text-brand-deep' : 'text-muted'} />
            {place.label}
          </button>
        );
      })}
    </div>
  );
};

/** After a new address is picked while booking, offer to keep it. */
export const SaveThisPlace: React.FC<{ address: string; coords: PlaceCoords | null }> = ({ address, coords }) => {
  const { places, unavailable } = useSavedPlaces();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);
  if (unavailable || !coords || !address.trim()) return null;
  const existing = placeAt(places, address, coords);
  if (existing) return savedAs ? <p className="-mt-2 mb-3 text-caption text-muted">Saved as {savedAs}.</p> : null;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const name = label.trim();
      await addSavedPlace({ label: name, address, coords, kind: guessKind(name) });
      setSavedAs(name); setOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this place.'); }
    finally { setBusy(false); }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => { setLabel(suggestLabel(places)); setOpen(true); }} className="-mt-2 mb-3 inline-flex items-center gap-1 text-caption font-semibold text-brand-deep hover:underline">
        <Plus size={13} /> Save this place
      </button>
    );
  }
  return (
    <div className="-mt-2 mb-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={label}
          maxLength={40}
          placeholder="Name it, e.g. Home, School, Piano"
          aria-label="Name for this place"
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && label.trim()) { event.preventDefault(); void save(); } }}
          className="h-10 min-w-0 flex-1 rounded-input border border-line bg-white px-3 text-label text-ink placeholder:text-muted focus:border-brand-deep focus:outline-none"
        />
        <button type="button" disabled={busy || !label.trim()} onClick={() => void save()} className="h-10 rounded-full bg-brand px-4 text-label font-semibold text-ink disabled:opacity-50">{busy ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full px-3 text-label font-semibold text-muted hover:text-ink">Cancel</button>
      </div>
      {error && <p className="mt-1.5 text-caption text-danger">{error}</p>}
    </div>
  );
};

interface Draft { id: string | null; label: string; kind: PlaceKind; kindChosen: boolean; address: string; coords: PlaceCoords | null }

const PlaceForm: React.FC<{ draft: Draft; places: SavedPlace[]; onClose: () => void }> = ({ draft: initial, places, onClose }) => {
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = draft.kindChosen ? draft.kind : guessKind(draft.label);

  const save = async () => {
    if (!draft.label.trim()) { setError('Give the place a name, like Home or School.'); return; }
    if (!draft.coords) { setError('Pick the address from the suggestions so we know exactly where it is.'); return; }
    setBusy(true); setError(null);
    const body = { label: draft.label.trim(), address: draft.address.trim(), coords: draft.coords, kind };
    try {
      if (draft.id) await updateSavedPlace(draft.id, body);
      else await addSavedPlace(body);
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this place.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={busy ? undefined : onClose} labelledBy="place-form-title">
      <h2 id="place-form-title" className="text-lg font-bold text-ink">{draft.id ? 'Edit place' : 'Add a place'}</h2>
      <p className="mt-1 mb-5 text-label text-muted">Pick it as pickup or drop-off when you book.</p>
      <Input label="Name" placeholder="Home, School, Piano lesson" maxLength={40} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
      {!draft.id && !draft.label && (
        <div className="-mt-2 mb-4 flex flex-wrap gap-2">
          {['Home', 'School', 'Piano lesson', 'Swimming'].filter((name) => !places.some((place) => place.label.toLowerCase() === name.toLowerCase())).map((name) => (
            <button key={name} type="button" onClick={() => setDraft({ ...draft, label: name })} className="h-8 rounded-full border border-line px-3 text-caption font-semibold text-ink hover:border-ink/30">{name}</button>
          ))}
        </div>
      )}
      <div className="relative z-20">
        <PlacesInput label="Address" placeholder="Search for the address" value={draft.address} onChange={(text) => setDraft((current) => ({ ...current, address: text, coords: null }))} onSelect={({ address, coords }) => setDraft((current) => ({ ...current, address, coords }))} />
      </div>
      <p className="mb-2 text-sm font-semibold text-ink">Icon</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Icon">
        {(Object.keys(KIND_LABEL) as PlaceKind[]).map((option) => (
          <button key={option} type="button" role="radio" aria-checked={kind === option} onClick={() => setDraft({ ...draft, kind: option, kindChosen: true })} className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-label font-semibold ${kind === option ? 'border-brand bg-brand/15 text-ink' : 'border-line text-ink hover:border-ink/30'}`}>
            <PlaceIcon kind={option} size={15} className={kind === option ? 'text-brand-deep' : 'text-muted'} /> {KIND_LABEL[option]}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={() => void save()} disabled={busy}>{busy ? 'Saving...' : draft.id ? 'Save changes' : 'Save place'}</Button>
      </div>
    </Modal>
  );
};

/** Profile section where a parent adds, edits and removes saved places. */
export const SavedPlacesCard = () => {
  const { places, loading, error, unavailable } = useSavedPlaces();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<SavedPlace | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const remove = async () => {
    if (!removing) return;
    setBusy(true); setRemoveError(null);
    try { await removeSavedPlace(removing.id); setRemoving(null); }
    catch (err) { setRemoveError(err instanceof Error ? err.message : 'Could not remove this place.'); }
    finally { setBusy(false); }
  };
  const newDraft = (): Draft => ({ id: null, label: suggestLabel(places), kind: 'other', kindChosen: false, address: '', coords: null });

  return (
    <section className="rounded-card border border-line bg-white p-5" aria-labelledby="saved-places-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-brand-deep" />
          <h3 id="saved-places-title" className="text-lead font-bold">Saved places</h3>
        </div>
        {!unavailable && places.length > 0 && (
          <button type="button" onClick={() => setDraft(newDraft())} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-deep hover:underline"><Plus size={16} /> Add</button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Home, school and activities, ready to pick when you book.</p>

      {unavailable ? <p className="mt-4 text-sm text-muted">Saved places are not switched on yet.</p>
        : loading ? <p className="mt-4 text-sm text-muted">Loading...</p>
        : error ? <p className="mt-4 text-sm text-danger">{error}</p>
        : places.length === 0 ? (
          <Button variant="secondary" className="mt-4" onClick={() => setDraft(newDraft())}><Plus size={16} /> Add your first place</Button>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {places.map((place) => (
              <li key={place.id} className="flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2"><PlaceIcon kind={place.kind} size={18} className="text-brand-deep" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{place.label}</p>
                  <p className="truncate text-label text-muted">{place.address}</p>
                </div>
                <button type="button" aria-label={`Edit ${place.label}`} onClick={() => setDraft({ id: place.id, label: place.label, kind: place.kind, kindChosen: true, address: place.address, coords: place.coords })} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><Pencil size={16} /></button>
                <button type="button" aria-label={`Remove ${place.label}`} onClick={() => { setRemoveError(null); setRemoving(place); }} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}

      {draft && <PlaceForm draft={draft} places={places} onClose={() => setDraft(null)} />}
      <ConfirmModal
        open={!!removing}
        title={`Remove ${removing?.label || 'this place'}?`}
        body={<p>Rides you have already booked keep their addresses.</p>}
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
        busyLabel="Removing..."
        error={removeError}
        onConfirm={() => void remove()}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
};
