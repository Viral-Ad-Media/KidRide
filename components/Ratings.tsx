import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Modal } from './UIComponents';
import { ApiError, apiRequest, getStoredToken } from '../services/api';
import { RideRating } from '../types';

export interface DriverRatingSummary {
  average: number | null;
  count: number;
  reviews: { stars: number; comment: string | null; createdAt: string }[];
}

export const fetchDriverRatingSummary = (driverId: string) =>
  apiRequest<DriverRatingSummary>(`/drivers/${encodeURIComponent(driverId)}/rating-summary`, { token: getStoredToken() });

export const rateRide = (rideId: string, stars: number, comment: string) =>
  apiRequest<RideRating>(`/rides/${encodeURIComponent(rideId)}/rating`, { method: 'POST', token: getStoredToken(), body: { stars, comment } });

/** Loads a driver's average rating; null while loading or when the call fails. */
export const useDriverRating = (driverId?: string) => {
  const [summary, setSummary] = useState<DriverRatingSummary | null>(null);
  useEffect(() => {
    if (!driverId) { setSummary(null); return; }
    let active = true;
    fetchDriverRatingSummary(driverId).then((result) => { if (active) setSummary(result); }).catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [driverId]);
  return summary;
};

export const Stars: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} className={n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
    ))}
  </span>
);

export const RatingBadge: React.FC<{ summary: Pick<DriverRatingSummary, 'average' | 'count'> | null; className?: string }> = ({ summary, className = '' }) => (
  summary && summary.count && summary.average !== null ? (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800 ${className}`}>
      <Star size={14} className="fill-amber-400 text-amber-400" />
      {summary.average.toFixed(1)}
      <span className="font-normal text-slate-500">({summary.count} {summary.count === 1 ? 'rating' : 'ratings'})</span>
    </span>
  ) : (
    <span className={`text-sm text-slate-500 ${className}`}>No ratings yet</span>
  )
);

export const RateRideModal: React.FC<{ rideId: string | null; onClose: () => void; onRated: (rideId: string, rating: RideRating) => void }> = ({ rideId, onClose, onRated }) => {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setStars(0); setComment(''); setError(null); }, [rideId]);

  const submit = async () => {
    if (!rideId) return;
    if (!stars) { setError('Choose how many stars to give.'); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = await rateRide(rideId, stars, comment.trim());
      onRated(rideId, { stars: saved.stars, comment: saved.comment ?? null });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save your rating.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!rideId} onClose={saving ? undefined : onClose} labelledBy="rate-ride-title">
      <h2 id="rate-ride-title" className="text-lg font-bold text-slate-950">Rate your driver</h2>
      <p className="mt-1 text-sm text-slate-500">How was this ride? Your rating helps other families.</p>
      <div className="mt-5 flex justify-center gap-2" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setStars(n)} className="rounded-full p-1 transition hover:scale-110">
            <Star size={34} className={n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
          </button>
        ))}
      </div>
      <label className="mt-5 block text-sm font-semibold text-slate-700">
        Comment (optional)
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={3} placeholder="What went well, or what could be better?" className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm font-normal" />
      </label>
      <p className="mt-1 text-right text-xs text-slate-400">{comment.length}/500</p>
      {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Not now</button>
        <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-full bg-[#1d6fff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1558d6] disabled:opacity-60">{saving ? 'Saving...' : 'Submit rating'}</button>
      </div>
    </Modal>
  );
};

/** A driver's own average rating and latest reviews (only visible to them and admins). */
export const DriverReviews: React.FC<{ driverId: string }> = ({ driverId }) => {
  const summary = useDriverRating(driverId);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Your rating</h3>
        <RatingBadge summary={summary} />
      </div>
      {summary?.reviews.length ? (
        <ul className="mt-4 space-y-3">
          {summary.reviews.slice(0, 5).map((review, index) => (
            <li key={`${review.createdAt}-${index}`} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <Stars value={review.stars} />
                <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              {review.comment && <p className="mt-2 text-sm text-slate-700">{review.comment}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Parents can rate you after each completed ride. Reviews will appear here.</p>
      )}
    </div>
  );
};
