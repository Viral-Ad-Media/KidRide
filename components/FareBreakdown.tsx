import React from 'react';
import { FareBreakdown as Fare } from '../types';
import { formatMoney } from '../utils/rideData';

// The charges that make up a quoted fare, one per line, with the total.
export const FareBreakdown: React.FC<{ fare: Fare; currency?: string; showTotal?: boolean; className?: string }> = ({ fare, currency = 'USD', showTotal = true, className = '' }) => (
  <div className={className}>
    <dl className="space-y-1 text-label">
      {fare.lines.map((line) => (
        <div key={line.key} className="flex justify-between gap-4">
          <dt className="text-muted">{line.label}</dt>
          <dd className="tabular-nums">{formatMoney(line.amount, currency)}</dd>
        </div>
      ))}
      {showTotal && (
        <div className="flex justify-between gap-4 border-t border-line pt-1 font-bold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(fare.total, currency)}</dd>
        </div>
      )}
    </dl>
    {fare.distanceSource === 'none' && <p className="mt-1 text-caption text-muted">Distance unknown because the addresses were typed, not picked from suggestions, so the minimum fare applies.</p>}
    {fare.distanceSource === 'estimate' && <p className="mt-1 text-caption text-muted">Distance estimated as a straight line with a road allowance; the price is fixed at booking.</p>}
  </div>
);
