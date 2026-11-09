import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Download, FileText, Lock, Trash2 } from 'lucide-react';
import { Button, Input } from './UIComponents';
import { useAuth } from '../contexts/AuthContext';
import { ApiError, apiRequest, getStoredToken } from '../services/api';
import { UserRole } from '../types';

// Profile section: legal documents, "Download my data" and "Delete account".
export const AccountPrivacy = () => {
  const navigate = useNavigate();
  const { user, deleteAccount } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) return null;
  const isAdmin = user.role === UserRole.ADMIN;

  const downloadData = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await apiRequest<unknown>('/account/export', { token: getStoredToken() || undefined, timeoutMs: 60000 });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kidride-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error instanceof ApiError ? error.message : 'Could not download your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(password);
      navigate('/', { replace: true });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete your account.');
      setDeleting(false);
    }
  };

  const rowClass = 'flex w-full items-center justify-between gap-3 px-4 py-4 text-left font-medium text-gray-700 transition-colors hover:bg-gray-50';

  return (
    <div className="space-y-3">
      <h3 className="px-1 pt-2 text-lead font-bold">Privacy and account</h3>
      <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white">
        <Link to="/terms" className={rowClass}>
          <span className="inline-flex items-center gap-3"><FileText size={18} className="text-brand-deep" /> Terms of Service</span>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>
        <Link to="/privacy" className={rowClass}>
          <span className="inline-flex items-center gap-3"><Lock size={18} className="text-brand-deep" /> Privacy Policy</span>
          <ChevronRight size={20} className="text-gray-400" />
        </Link>
        <button type="button" onClick={() => void downloadData()} disabled={exporting} className={rowClass}>
          <span className="inline-flex items-center gap-3">
            <Download size={18} className="text-brand-deep" />
            <span>
              <span className="block">{exporting ? 'Preparing your data...' : 'Download my data'}</span>
              <span className="block text-sm font-normal text-muted">Your account, {user.role === UserRole.PARENT ? 'children, ' : ''}rides and messages as a file</span>
            </span>
          </span>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
        {!isAdmin && (
          <button type="button" onClick={() => { setConfirming(true); setDeleteError(null); }} className={`${rowClass} text-danger`}>
            <span className="inline-flex items-center gap-3"><Trash2 size={18} /> Delete account</span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        )}
      </div>
      {exportError && <p className="text-sm text-danger">{exportError}</p>}

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-title" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-card bg-white p-6 shadow-float">
            <h2 id="delete-title" className="text-lg font-bold text-ink">Delete your KidRide account?</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>You will be signed out everywhere and can't log in again.</li>
              {user.role === UserRole.PARENT && <li>Your children's details, trusted contacts and upcoming scheduled rides are removed.</li>}
              {user.role === UserRole.DRIVER && <li>Your documents and vehicle photos are deleted. Upcoming rides go back to other drivers.</li>}
              <li>Past ride and safety records are kept without your name, as the Privacy Policy explains.</li>
              <li>A ride in progress must finish first.</li>
            </ul>
            <p className="mt-3 text-sm text-muted">Want a copy first? Use Download my data before deleting.</p>
            <div className="mt-4">
              <Input label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              <Input label='Type DELETE to confirm' value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
            </div>
            {deleteError && <p className="mt-2 text-sm text-danger">{deleteError}</p>}
            <div className="mt-4 flex gap-3">
              <Button variant="secondary" onClick={() => { setConfirming(false); setPassword(''); setTyped(''); }} disabled={deleting}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => void confirmDelete()}
                disabled={deleting || !password || typed.trim().toUpperCase() !== 'DELETE'}
              >
                {deleting ? 'Deleting...' : 'Delete account'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
