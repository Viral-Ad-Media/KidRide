import React, { useEffect, useRef, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { Button } from '../UIComponents';
import { ApiError } from '../../services/api';
import { PaymentConfig, SavedCard, cardLabel, fetchPaymentConfig, finishCardSetup, loadStripe, removeCard, startCardSetup } from '../../services/payments';

const message = (error: unknown, fallback: string) => (error instanceof ApiError || error instanceof Error ? error.message : fallback);

/**
 * The parent's saved card: shows it, and adds or replaces it with Stripe's card
 * form. Renders nothing while payments are off. onChange fires after a save.
 */
export const CardSetup: React.FC<{ compact?: boolean; onChange?: (card: SavedCard | null) => void }> = ({ compact = false, onChange }) => {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [card, setCard] = useState<SavedCard | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<{ stripe: any; elements: any } | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    fetchPaymentConfig().then((next) => { setConfig(next); setCard(next.card || null); }).catch(() => setConfig({ enabled: false }));
  }, []);

  useEffect(() => {
    if (!editing || !config?.publishableKey) return undefined;
    let cancelled = false;
    let element: { destroy: () => void } | null = null;
    (async () => {
      try {
        setBusy(true);
        const [stripe, { clientSecret }] = await Promise.all([loadStripe(config.publishableKey!), startCardSetup()]);
        if (cancelled || !mountRef.current) return;
        const elements = stripe.elements({ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#0369A1', colorText: '#14213D', colorDanger: '#D7263D', borderRadius: '12px', fontFamily: 'inherit' } } });
        element = elements.create('payment', { layout: 'tabs' });
        (element as unknown as { mount: (node: HTMLElement) => void }).mount(mountRef.current);
        stripeRef.current = { stripe, elements };
      } catch (err) {
        if (!cancelled) setError(message(err, 'Could not open the card form'));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; element?.destroy(); stripeRef.current = null; };
  }, [editing, config?.publishableKey]);

  if (!config?.enabled) return null;

  const save = async () => {
    if (!stripeRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const { stripe, elements } = stripeRef.current;
      const result = await stripe.confirmSetup({ elements, redirect: 'if_required' });
      if (result.error) throw new Error(result.error.message || 'The card was not saved');
      const saved = await finishCardSetup(result.setupIntent.id);
      setCard(saved.card);
      setEditing(false);
      onChange?.(saved.card);
    } catch (err) {
      setError(message(err, 'The card was not saved'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeCard();
      setCard(null);
      onChange?.(null);
    } catch (err) {
      setError(message(err, 'Could not remove the card'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'space-y-3' : 'rounded-card border border-line bg-white p-5 space-y-4'}>
      {!compact && (
        <div className="flex items-center gap-2">
          <CreditCard size={20} className="text-brand-deep" />
          <h3 className="text-lead font-bold text-ink">Payment card</h3>
          {config.testMode && <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-caption font-semibold text-muted">Test mode</span>}
        </div>
      )}
      {card && !editing && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">{cardLabel(card)}</p>
            {card.expMonth && card.expYear && <p className="text-caption text-muted">Expires {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="min-h-[40px] px-4" onClick={() => setEditing(true)} disabled={busy}>Replace</Button>
            {!compact && <Button variant="ghost" className="min-h-[40px] px-4" onClick={remove} disabled={busy}>Remove</Button>}
          </div>
        </div>
      )}
      {!card && !editing && (
        <>
          <p className="text-sm text-muted">Add a card to book rides. We hold the fare when a driver accepts and charge it after drop-off.</p>
          <Button fullWidth onClick={() => setEditing(true)}>Add a card</Button>
        </>
      )}
      {editing && (
        <>
          <div ref={mountRef} className="min-h-[120px]" />
          <p className="text-caption text-muted">Your card details go straight to Stripe, our payment processor. KidRide only keeps the brand and last 4 digits.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={busy || !stripeRef.current}>{busy ? 'Saving…' : 'Save card'}</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setError(null); }} disabled={busy}>Cancel</Button>
          </div>
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
};
