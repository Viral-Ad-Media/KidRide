import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { Button } from '../UIComponents';
import { ApiError } from '../../services/api';
import { PayoutSummary, fetchPaymentConfig, fetchPayouts, formatMoney, payoutDashboardLink, payoutOnboardingLink } from '../../services/payments';

const STATUS_TEXT: Record<PayoutSummary['status'], string> = {
  not_started: 'Add your bank details to get paid for your rides.',
  incomplete: 'Finish your payout setup so we can send your earnings.',
  in_review: 'Stripe is checking your details. Earnings wait safely until it is done.',
  ready: 'Your earnings are sent to your bank after each ride.'
};

/** Driver payouts (Stripe Express): set up bank details, see paid and waiting earnings. Hidden while payments are off. */
export const DriverPayouts: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentConfig().then((config) => {
      setEnabled(config.enabled);
      if (config.enabled) fetchPayouts().then(setSummary).catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load payouts'));
    }).catch(() => setEnabled(false));
  }, []);

  if (!enabled) return null;

  const open = async (make: () => Promise<{ url: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await make();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open Stripe. Try again.');
      setBusy(false);
    }
  };

  const currency = summary?.currency || 'USD';
  return (
    <div className="rounded-card border border-line bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Landmark size={20} className="text-brand-deep" />
        <h3 className="text-lead font-bold text-ink">Payouts</h3>
      </div>
      {summary && (
        <>
          <p className="text-sm text-muted">{STATUS_TEXT[summary.status]}</p>
          {(summary.paid > 0 || summary.pending > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface p-3"><p className="text-caption text-muted">Paid out</p><p className="text-lead font-bold text-ink">{formatMoney(summary.paid, currency)}</p></div>
              <div className="rounded-xl bg-surface p-3"><p className="text-caption text-muted">Waiting</p><p className="text-lead font-bold text-ink">{formatMoney(summary.pending, currency)}</p></div>
            </div>
          )}
          {summary.status === 'ready'
            ? <Button variant="secondary" fullWidth onClick={() => open(payoutDashboardLink)} disabled={busy}>View payouts in Stripe</Button>
            : <Button fullWidth onClick={() => open(payoutOnboardingLink)} disabled={busy}>{busy ? 'Opening Stripe…' : summary.status === 'not_started' ? 'Set up payouts' : 'Continue setup'}</Button>}
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
};

/** Dashboard reminder while the driver has not finished payout setup. */
export const PayoutSetupNudge: React.FC = () => {
  const [status, setStatus] = useState<PayoutSummary['status'] | null>(null);
  useEffect(() => {
    fetchPaymentConfig().then((config) => (config.enabled ? fetchPayouts().then((summary) => setStatus(summary.status)) : undefined)).catch(() => undefined);
  }, []);
  if (!status || status === 'ready') return null;
  return (
    <p className="text-label text-ink">
      {status === 'in_review' ? 'Stripe is checking your payout details.' : 'Set up payouts so we can send your earnings.'}{' '}
      <Link to="/profile/payments" className="font-semibold text-brand-deep underline">Open payouts</Link>
    </p>
  );
};
