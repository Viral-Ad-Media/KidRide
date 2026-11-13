import { apiRequest, getStoredToken } from './api';

// Stripe card payments and driver payouts. Everything here stays hidden while
// the backend reports payments as off (no Stripe keys yet).

export interface SavedCard { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null }
export interface PaymentConfig { enabled: boolean; testMode?: boolean; publishableKey?: string; card?: SavedCard | null }
export interface PayoutSummary { status: 'not_started' | 'incomplete' | 'in_review' | 'ready'; paid: number; pending: number; currency: string | null }

const token = () => getStoredToken() || undefined;

export const fetchPaymentConfig = () => apiRequest<PaymentConfig>('/payments/config', { token: token() });
export const startCardSetup = () => apiRequest<{ clientSecret: string }>('/payments/card/setup', { method: 'POST', token: token() });
export const finishCardSetup = (setupIntentId: string) => apiRequest<{ card: SavedCard }>('/payments/card/confirm', { method: 'POST', token: token(), body: { setupIntentId } });
export const removeCard = () => apiRequest<{ card: null }>('/payments/card', { method: 'DELETE', token: token() });
export const paymentAction = (rideId: string) => apiRequest<{ clientSecret: string }>(`/payments/rides/${rideId}/action`, { method: 'POST', token: token() });
export const paymentConfirmed = (rideId: string) => apiRequest(`/payments/rides/${rideId}/confirmed`, { method: 'POST', token: token() });
export const retryPayment = (rideId: string) => apiRequest(`/payments/rides/${rideId}/retry`, { method: 'POST', token: token() });
export const fetchPayouts = () => apiRequest<PayoutSummary>('/payments/payouts', { token: token() });
export const payoutOnboardingLink = () => apiRequest<{ url: string }>('/payments/payouts/onboarding', { method: 'POST', token: token() });
export const payoutDashboardLink = () => apiRequest<{ url: string }>('/payments/payouts/dashboard', { method: 'POST', token: token() });

// Stripe.js from Stripe's own servers (card details never touch KidRide), loaded on first use.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type StripeJs = any;
let loading: Promise<StripeJs> | null = null;
export const loadStripe = (publishableKey: string): Promise<StripeJs> => {
  loading ??= new Promise((resolve, reject) => {
    const ready = () => ((window as any).Stripe ? resolve((window as any).Stripe(publishableKey)) : reject(new Error('Stripe did not load')));
    if ((window as any).Stripe) return ready();
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = ready;
    script.onerror = () => { loading = null; reject(new Error('Could not load the card form. Check your connection.')); };
    document.head.appendChild(script);
  });
  return loading;
};

/** Lets the parent's bank confirm a held or charged payment (3-D Secure), then tells the server. */
export const confirmRidePayment = async (rideId: string) => {
  const config = await fetchPaymentConfig();
  if (!config.enabled || !config.publishableKey) throw new Error('Payments are off');
  const stripe = await loadStripe(config.publishableKey);
  const { clientSecret } = await paymentAction(rideId);
  const result = await stripe.handleNextAction({ clientSecret });
  if (result.error) throw new Error(result.error.message || 'Payment not confirmed');
  return paymentConfirmed(rideId);
};

export const formatMoney = (amount: number, currency = 'USD') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
export const cardLabel = (card: SavedCard) => `${card.brand ? card.brand[0].toUpperCase() + card.brand.slice(1) : 'Card'} ending ${card.last4 || '····'}`;
