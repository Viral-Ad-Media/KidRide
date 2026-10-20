/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from './UIComponents';
import { LatLng, useGoogleMaps } from '../services/googleMaps';

// Address field with Google Places suggestions (Places API New). One session
// token covers the typing and the final place lookup, which Google bills as a
// single session. Without maps it behaves as a plain text field.

interface PlacesInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (text: string) => void;
  /** Called with the chosen address and its coordinates. */
  onSelect: (place: { address: string; coords: LatLng }) => void;
}

interface Suggestion {
  id: string;
  text: string;
  prediction: google.maps.places.PlacePrediction;
}

export const PlacesInput: React.FC<PlacesInputProps> = ({ label, placeholder, value, onChange, onSelect }) => {
  const mapsState = useGoogleMaps();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const session = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const skipNext = useRef(false);
  const latest = useRef(0);

  useEffect(() => {
    if (mapsState.status !== 'ready') return;
    if (skipNext.current) { skipNext.current = false; return; }
    const text = value.trim();
    if (text.length < 3) { setSuggestions([]); return; }
    const places = mapsState.maps.places;
    if (!session.current) session.current = new places.AutocompleteSessionToken();
    const request = ++latest.current;
    const timer = setTimeout(() => {
      places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: text, sessionToken: session.current || undefined })
        .then(({ suggestions: found }) => {
          if (request !== latest.current) return;
          setSuggestions(found
            .map((s) => s.placePrediction)
            .filter((p): p is google.maps.places.PlacePrediction => !!p)
            .slice(0, 5)
            .map((p) => ({ id: p.placeId, text: p.text.toString(), prediction: p })));
          setOpen(true);
        })
        .catch(() => { if (request === latest.current) setSuggestions([]); });
    }, 250);
    return () => clearTimeout(timer);
  }, [value, mapsState.status]);

  const choose = async (suggestion: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ['formattedAddress', 'location'] });
      session.current = null; // the session ends with this lookup
      const address = place.formattedAddress || suggestion.text;
      skipNext.current = true;
      onChange(address);
      if (place.location) onSelect({ address, coords: { lat: place.location.lat(), lng: place.location.lng() } });
    } catch {
      skipNext.current = true;
      onChange(suggestion.text);
    }
  };

  return (
    <div className="relative">
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length && setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <ul role="listbox" aria-label={`${label} suggestions`} className="absolute left-0 right-0 z-30 -mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => void choose(suggestion)} className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm text-slate-700 hover:bg-blue-50">
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#1d6fff]" />
                {suggestion.text}
              </button>
            </li>
          ))}
          <li className="px-4 py-1.5 text-right text-[10px] text-slate-400">Powered by Google</li>
        </ul>
      )}
    </div>
  );
};
