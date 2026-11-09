import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { Modal } from './UIComponents';
import { ApiError, apiRequest, getStoredToken } from '../services/api';
import { RideRating } from '../types';

export interface Compliment { tag: string; label: string; count: number }

export interface DriverRatingSummary {
  average: number | null;
  count: number;
  compliments?: Compliment[];
  reviews: { stars: number; tags?: string[]; comment: string | null; createdAt: string }[];
}

// Same keys as the backend (lib/ratingRules.js). Compliments for 4-5 stars, issues for 1-3.
type TagSet = { compliment: Record<string, string>; issue: Record<string, string> };
export const DRIVER_TAGS: TagSet = {
  compliment: { safe_driving: 'Safe driving', on_time: 'On time', friendly: 'Friendly', clean_car: 'Clean car', great_with_kids: 'Great with kids', smooth_handoff: 'Smooth handoff' },
  issue: { late: 'Late', unsafe_driving: 'Unsafe driving', route_issue: 'Odd route', unfriendly: 'Unfriendly', car_condition: 'Car condition', handoff_problem: 'Handoff problem' }
};
export const FAMILY_TAGS: TagSet = {
  compliment: { ready_on_time: 'Ready on time', clear_pickup: 'Clear pickup spot', respectful: 'Respectful', lovely_kids: 'Lovely kids' },
  issue: { kept_waiting: 'Kept me waiting', wrong_pickup_spot: 'Wrong pickup spot', rude: 'Rude', unsafe_behaviour: 'Unsafe behaviour' }
};

export const fetchDriverRatingSummary = (driverId: string) =>
  apiRequest<DriverRatingSummary>(`/drivers/${encodeURIComponent(driverId)}/rating-summary`, { token: getStoredToken() });

export const rateRide = (rideId: string, stars: number, comment: string, tags: string[] = [], target: 'driver' | 'family' = 'driver') =>
  apiRequest<RideRating>(`/rides/${encodeURIComponent(rideId)}/${target === 'family' ? 'family-rating' : 'rating'}`, { method: 'POST', token: getStoredToken(), body: { stars, comment, tags } });

/** The family's average, for the driver of the ride. Null while loading or when none. */
export const FamilyRatingBadge: React.FC<{ rideId: string; className?: string }> = ({ rideId, className = '' }) => {
  const [summary, setSummary] = useState<{ average: number | null; count: number } | null>(null);
  useEffect(() => {
    let active = true;
    apiRequest<{ average: number | null; count: number }>(`/rides/${encodeURIComponent(rideId)}/family-rating`, { token: getStoredToken() })
      .then((result) => { if (active) setSummary(result); }).catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [rideId]);
  if (!summary) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-label text-muted ${className}`}>
      Family rating
      {summary.count && summary.average !== null
        ? <span className="inline-flex items-center gap-1 font-semibold text-ink"><Star size={13} className="fill-accent text-accent" />{summary.average.toFixed(1)} <span className="font-normal text-muted">({summary.count})</span></span>
        : <span className="font-semibold text-ink">new family</span>}
    </span>
  );
};

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

const STAR_WORDS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Great'];

const RatingModal: React.FC<{ rideId: string | null; target: 'driver' | 'family'; onClose: () => void; onRated: (rideId: string, rating: RideRating) => void }> = ({ rideId, target, onClose, onRated }) => {
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = target === 'family' ? FAMILY_TAGS : DRIVER_TAGS;
  const options = stars >= 4 ? set.compliment : stars ? set.issue : {};

  useEffect(() => { setStars(0); setTags([]); setComment(''); setError(null); }, [rideId]);
  // Changing between good and bad clears tags that no longer fit.
  const pick = (n: number) => { if ((n >= 4) !== (stars >= 4)) setTags([]); setStars(n); };
  const toggle = (tag: string) => setTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  const submit = async () => {
    if (!rideId) return;
    if (!stars) { setError('Choose how many stars to give.'); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = await rateRide(rideId, stars, comment.trim(), tags, target);
      onRated(rideId, { stars: saved.stars, tags: saved.tags || tags, comment: saved.comment ?? null });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not save your rating.');
    } finally {
      setSaving(false);
    }
  };

  const title = target === 'family' ? 'Rate the family' : 'Rate your driver';
  const intro = target === 'family' ? 'How was the pickup and drop-off? Families never see who rated them.' : 'How was this ride? Your rating is anonymous and helps keep KidRide safe.';
  return (
    <Modal open={!!rideId} onClose={saving ? undefined : onClose} labelledBy="rate-ride-title">
      <h2 id="rate-ride-title" className="text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{intro}</p>
      <div className="mt-5 flex justify-center gap-2" role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => pick(n)} className="rounded-full p-1 transition hover:scale-110">
            <Star size={34} className={n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-5 text-center text-sm font-semibold text-slate-700">{STAR_WORDS[stars]}</p>
      {stars > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700">{stars >= 4 ? 'What went well?' : 'What went wrong?'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(options).map(([tag, label]) => {
              const on = tags.includes(tag);
              return (
                <button key={tag} type="button" aria-pressed={on} onClick={() => toggle(tag)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${on ? (stars >= 4 ? 'border-brand-deep bg-brand/15 text-brand-deep' : 'border-danger bg-danger/10 text-danger') : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <label className="mt-5 block text-sm font-semibold text-slate-700">
        Comment (optional)
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={3} placeholder={stars && stars <= 2 ? 'Tell us what happened. Our safety team reads every low rating.' : 'Anything else to add?'} className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm font-normal" />
      </label>
      <p className="mt-1 text-right text-xs text-slate-400">{comment.length}/500</p>
      {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={saving} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Not now</button>
        <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink hover:brightness-95 disabled:opacity-60">{saving ? 'Saving...' : 'Submit rating'}</button>
      </div>
    </Modal>
  );
};

export const RateRideModal: React.FC<{ rideId: string | null; onClose: () => void; onRated: (rideId: string, rating: RideRating) => void }> = (props) => <RatingModal target="driver" {...props} />;
export const RateFamilyModal: React.FC<{ rideId: string | null; onClose: () => void; onRated: (rideId: string, rating: RideRating) => void }> = (props) => <RatingModal target="family" {...props} />;

/** A driver's own average rating and latest reviews (only visible to them and admins). */
export const DriverReviews: React.FC<{ driverId: string }> = ({ driverId }) => {
  const summary = useDriverRating(driverId);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Your rating</h3>
        <RatingBadge summary={summary} />
      </div>
      <p className="mt-1 text-xs text-slate-500">Based on your last 100 rated trips. Ratings under 4.5 are reviewed by the KidRide team.</p>
      {summary?.compliments?.length ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700">Compliments</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.compliments.map((item) => (
              <span key={item.tag} className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand-deep">{item.label} <span className="font-normal text-slate-500">{item.count}</span></span>
            ))}
          </div>
        </div>
      ) : null}
      {summary?.reviews.length ? (
        <ul className="mt-4 space-y-3">
          {summary.reviews.slice(0, 5).map((review, index) => (
            <li key={`${review.createdAt}-${index}`} className="rounded-xl bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <Stars value={review.stars} />
                <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              {review.tags?.length ? <p className="mt-1 text-xs font-semibold text-slate-500">{review.tags.join(' · ')}</p> : null}
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
