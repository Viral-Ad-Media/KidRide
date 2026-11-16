import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ride } from '../../types';
import { confirmRidePayment, formatMoney, retryPayment } from '../../services/payments';

const LABELS: Record<string, string> = {
  authorized: 'Held on your card',
  processing: 'Payment processing',
  succeeded: 'Paid by card',
  canceled: 'Hold released, not charged'
};

/** One line under a ride: what was held or charged, and a fix-it action when the card failed. */
export const RidePaymentStatus: React.FC<{ ride: Ride; onChanged?: () => void }> = ({ ride, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payment = ride.payment;
  if (!payment || payment.status === 'none') return null;
  const currency = payment.currency || ride.currency || 'USD';

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await work(); onChanged?.(); } catch (err) { setError(err instanceof Error ? err.message : 'That did not work. Try again.'); } finally { setBusy(false); }
  };

  if (payment.status === 'requires_action' || payment.status === 'failed') {
    return (
      <div className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-label">
        <p className="font-semibold text-ink">{payment.status === 'requires_action' ? 'Your bank needs you to confirm this payment' : `Payment did not go through${payment.error ? `: ${payment.error}` : ''}`}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {payment.status === 'requires_action'
            ? <button type="button" disabled={busy} onClick={() => act(() => confirmRidePayment(ride.id))} className="font-semibold text-brand-deep underline">{busy ? 'Confirming…' : 'Confirm payment'}</button>
            : <button type="button" disabled={busy} onClick={() => act(() => retryPayment(ride.id))} className="font-semibold text-brand-deep underline">{busy ? 'Trying…' : 'Try again'}</button>}
          <Link to="/profile/payments" className="font-semibold text-brand-deep underline">Change card</Link>
        </div>
        {error && <p className="mt-2 text-danger">{error}</p>}
      </div>
    );
  }

  const amount = payment.status === 'authorized' ? payment.amountHeld : payment.amountCharged;
  return (
    <p className="mt-2 text-caption text-muted">
      {LABELS[payment.status] || payment.status}{amount > 0 ? ` · ${formatMoney(amount, currency)}` : ''}
      {payment.amountRefunded > 0 ? ` · ${formatMoney(payment.amountRefunded, currency)} refunded` : ''}
    </p>
  );
};
