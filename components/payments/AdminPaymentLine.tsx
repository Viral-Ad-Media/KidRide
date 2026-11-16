import React, { useState } from 'react';
import { apiRequest, getStoredToken } from '../../services/api';
import { Ride } from '../../types';
import { formatMoney, retryPayment } from '../../services/payments';

const STATUS: Record<string, string> = {
  authorized: 'Held', requires_action: 'Waiting for parent to confirm with their bank', processing: 'Processing',
  succeeded: 'Charged', failed: 'Failed', canceled: 'Hold released'
};
const PAYOUT: Record<string, string> = { pending: 'driver payout waiting for their bank details', paid: 'driver paid', failed: 'driver payout failed' };

/** Admin: a ride's card payment, with refund and retry. Hidden while payments are off. */
export const AdminPaymentLine: React.FC<{ ride: Ride; onChanged: (message: string) => void }> = ({ ride, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [fromDriver, setFromDriver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const payment = ride.payment;
  if (!payment || payment.status === 'none') return null;
  const currency = payment.currency || ride.currency || 'USD';
  const refundable = Math.round((payment.amountCharged - payment.amountRefunded) * 100) / 100;

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try { await work(); setOpen(false); onChanged(done); } catch (err) { setError(err instanceof Error ? err.message : 'That did not work'); } finally { setBusy(false); }
  };
  const refund = () => run(() => apiRequest(`/payments/rides/${ride.id}/refund`, {
    method: 'POST', token: getStoredToken() || undefined,
    body: { amount: amount.trim() ? Number(amount) : null, fromDriver, reason: 'Admin refund' }
  }), 'Refund sent.');

  return (
    <div className="mt-1 text-xs text-muted">
      <span className="font-semibold text-ink">Card: {STATUS[payment.status] || payment.status}</span>
      {payment.status === 'authorized' && ` ${formatMoney(payment.amountHeld, currency)}`}
      {payment.amountCharged > 0 && ` ${formatMoney(payment.amountCharged, currency)}`}
      {payment.amountRefunded > 0 && ` - refunded ${formatMoney(payment.amountRefunded, currency)}`}
      {payment.error && ` - ${payment.error}`}
      {PAYOUT[payment.payoutStatus] && ` - ${PAYOUT[payment.payoutStatus]} (${formatMoney(payment.payoutAmount, currency)})`}
      {payment.status === 'failed' && (
        <button type="button" disabled={busy} onClick={() => run(() => retryPayment(ride.id), 'Charge retried.')} className="ml-2 font-semibold text-brand-deep underline">Retry charge</button>
      )}
      {payment.status === 'succeeded' && refundable > 0 && !open && (
        <button type="button" onClick={() => setOpen(true)} className="ml-2 font-semibold text-brand-deep underline">Refund</button>
      )}
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="number" min="0" step="0.01" max={refundable} placeholder={`Full ${formatMoney(refundable, currency)}`} value={amount} onChange={(e) => setAmount(e.target.value)} className="w-36 rounded-full border border-line px-3 py-1.5 text-sm text-ink" aria-label="Refund amount" />
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={fromDriver} onChange={(e) => setFromDriver(e.target.checked)} /> Take the driver's share back too</label>
          <button type="button" disabled={busy} onClick={refund} className="rounded-full bg-danger px-3 py-1.5 font-semibold text-white disabled:opacity-50">{busy ? 'Refunding…' : 'Refund'}</button>
          <button type="button" onClick={() => setOpen(false)} className="font-semibold text-muted">Cancel</button>
        </div>
      )}
      {error && <p className="mt-1 text-danger">{error}</p>}
    </div>
  );
};
