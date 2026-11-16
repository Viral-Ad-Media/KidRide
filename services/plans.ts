import { apiRequest, getStoredToken } from './api';

// Monthly family plans. Hidden while the backend reports payments as off.

export interface Plan { id: string; name: string; monthlyPrice: number; currency: string; discountPercent: number; ridesPerWeek: number; maxDiscountPerRide: number; maxMiles: number | null }
export interface ParentSubscription {
  planId: string;
  status: string;
  terms: Plan;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  live: boolean;
}
export interface PlansOverview { enabled: boolean; currency?: string; plans?: Plan[]; subscription?: ParentSubscription | null; usage?: { used: number; cap: number } | null }
/** Sent with ride quotes when the parent has a plan. */
export interface QuotePlan { name: string; ridesPerWeek: number; ridesLeftThisWeek: number }

const token = () => getStoredToken() || undefined;

export const fetchPlans = () => apiRequest<PlansOverview>('/subscriptions', { token: token() });
export const startPlanCheckout = (planId: string) => apiRequest<{ url: string }>('/subscriptions/checkout', { method: 'POST', token: token(), body: { planId } });
export const cancelPlan = () => apiRequest<{ subscription: ParentSubscription }>('/subscriptions/cancel', { method: 'POST', token: token() });
export const resumePlan = () => apiRequest<{ subscription: ParentSubscription }>('/subscriptions/resume', { method: 'POST', token: token() });
