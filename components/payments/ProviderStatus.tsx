import React, { useEffect, useState } from 'react';
import { apiRequest, getStoredToken } from '../../services/api';

interface Providers {
  payments: { enabled: boolean; testMode: boolean | null; webhook: boolean; connectWebhook: boolean };
  identity: { enabled: boolean; webhook: boolean };
  plateReader: { enabled: boolean; region: string | null; usage: { used: number; limit: number | null; resetsOn: string | null } | null };
  faceMatch: { enabled: boolean };
  backgroundCheck: { mode: 'checkr' | 'manual' | 'off' };
}

const On: React.FC<{ on: boolean; label?: string }> = ({ on, label }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${on ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted'}`}>{label || (on ? 'On' : 'Off: admin review')}</span>
);

/** Admin: which outside services have keys, and Plate Recognizer's monthly reads. */
export const ProviderStatus: React.FC = () => {
  const [p, setP] = useState<Providers | null>(null);
  useEffect(() => { apiRequest<Providers>('/payments/providers', { token: getStoredToken() || undefined }).then(setP).catch(() => setP(null)); }, []);
  if (!p) return null;
  const usage = p.plateReader.usage;
  const rows: [string, React.ReactNode, string][] = [
    ['Plate reading (Plate Recognizer)', <On on={p.plateReader.enabled} />, p.plateReader.enabled && usage ? `${usage.used}${usage.limit ? ` of ${usage.limit}` : ''} reads this month${usage.resetsOn ? `, resets ${usage.resetsOn}` : ''}` : 'Add PLATE_RECOGNIZER_TOKEN on the backend'],
    ['ID and selfie (Stripe Identity)', <On on={p.identity.enabled} />, p.identity.enabled ? (p.identity.webhook ? 'Webhook connected' : 'Add STRIPE_IDENTITY_WEBHOOK_SECRET') : 'Add STRIPE_SECRET_KEY'],
    ['Card payments (Stripe)', <On on={p.payments.enabled} label={p.payments.enabled ? (p.payments.testMode ? 'Test mode' : 'Live') : 'Off'} />, p.payments.enabled ? (p.payments.webhook ? 'Webhook connected' : 'Add STRIPE_WEBHOOK_SECRET') : 'Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY'],
    ['Face matching (AWS)', <On on={p.faceMatch.enabled} />, ''],
    ['Background checks', <On on={p.backgroundCheck.mode !== 'off'} label={p.backgroundCheck.mode === 'checkr' ? 'Checkr' : p.backgroundCheck.mode === 'manual' ? 'Manual' : 'Off'} />, '']
  ];
  return (
    <section>
      <h2 className="mb-2 text-title font-bold">Services</h2>
      <ul className="divide-y divide-line rounded-card border border-line bg-white">
        {rows.map(([name, badge, note]) => (
          <li key={name} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-label">
            <span className="min-w-[14rem] font-semibold">{name}</span>{badge}<span className="text-caption text-muted">{note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
