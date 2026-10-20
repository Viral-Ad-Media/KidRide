import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import { Button } from './UIComponents';
import { apiRequest, getStoredToken } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface ApplicationInfo {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  submittedAt: string | null;
  reviewNote?: string | null;
}

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const STYLES = {
  pending: { icon: Clock, title: 'Under review', box: 'border-amber-200 bg-amber-50', text: 'text-amber-800', detail: 'An admin is checking your documents. Ride offers unlock as soon as you are approved.' },
  approved: { icon: CheckCircle, title: 'Approved', box: 'border-green-200 bg-green-50', text: 'text-green-800', detail: 'You are a verified KidRide driver and can receive ride offers.' },
  rejected: { icon: XCircle, title: 'Not approved', box: 'border-red-200 bg-red-50', text: 'text-red-800', detail: 'Check your details, upload clear photos of each document and submit again.' },
  none: { icon: FileText, title: 'Not submitted yet', box: 'border-slate-200 bg-slate-50', text: 'text-slate-700', detail: 'Submit your phone, vehicle and documents to start verification.' }
} as const;

/** A driver's application status, submission date and (when rejected) the reviewer's note. */
export const DriverApplicationStatus: React.FC<{ onCheckStatus?: () => void; checking?: boolean; note?: string | null }> = ({ onCheckStatus, checking, note }) => {
  const { user } = useAuth();
  const [info, setInfo] = useState<ApplicationInfo | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token || user?.role !== UserRole.DRIVER) return;
    let active = true;
    apiRequest<ApplicationInfo>('/users/driver-application', { token })
      .then((result) => { if (active) setInfo(result); })
      .catch(() => { if (active) setInfo(null); });
    return () => { active = false; };
  }, [user?.driverApplicationStatus, user?.role]);

  const status = info?.status || user?.driverApplicationStatus || 'none';
  const style = STYLES[status];
  const Icon = style.icon;
  const submitted = formatDate(info?.submittedAt || null);

  return (
    <div className={`rounded-2xl border p-4 text-left ${style.box}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 shrink-0 ${style.text}`} size={20} />
        <div className="min-w-0 flex-1">
          <p className={`font-bold ${style.text}`}>Application status: {style.title}</p>
          {submitted && <p className={`mt-1 text-xs ${style.text}`}>Submitted on {submitted}</p>}
          <p className={`mt-2 text-sm ${style.text}`}>{style.detail}</p>
          {status === 'rejected' && info?.reviewNote && <p className={`mt-2 text-sm font-medium ${style.text}`}>Reason: {info.reviewNote}</p>}
          {onCheckStatus && status === 'pending' && (
            <Button className="mt-4 h-10 text-sm" onClick={onCheckStatus} disabled={checking}>
              {checking ? 'Checking...' : 'Check status'}
            </Button>
          )}
          {note && <p className={`mt-3 text-xs ${style.text}`}>{note}</p>}
        </div>
      </div>
    </div>
  );
};
