import { useEffect, useState } from 'react';
import { apiRequest, getStoredToken } from '../services/api';
import { formatMoney } from './rideData';

/** While a parent's cancel dialog is open, the sentence saying what cancelling costs now. */
export const useCancellationFeeNote = (rideId: string | null | undefined, open: boolean): string => {
  const [note, setNote] = useState('');
  useEffect(() => {
    setNote('');
    if (!open || !rideId) return;
    let live = true;
    apiRequest<{ fee: number; currency: string }>(`/rides/${encodeURIComponent(rideId)}/cancellation-fee`, { token: getStoredToken() })
      .then(({ fee, currency }) => { if (live) setNote(fee > 0 ? `A ${formatMoney(fee, currency)} cancellation fee applies.` : 'Cancelling now is free.'); })
      .catch(() => {});
    return () => { live = false; };
  }, [rideId, open]);
  return note;
};
