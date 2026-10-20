import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Loader2, RefreshCw, X, XCircle } from 'lucide-react';
import { ConfirmModal, Modal, StatusChip } from '../components/UIComponents';
import { ApiError, RideScope } from '../services/api';
import {
  AdminRide,
  ApplicationStatus,
  DOCUMENT_LABELS,
  DocumentKey,
  DriverApplicationDetail,
  DriverApplicationSummary,
  TERMINAL_RIDE_STATUSES,
  adminCancelRide,
  adminOverrideRideStatus,
  blockUser,
  fetchManagedUsers,
  ManagedUser,
  ManagedUserPage,
  RatingSummary,
  revokeDriverApproval,
  unblockUser,
  errorMessage,
  fetchAdminRides,
  fetchDriverApplicationDetail,
  fetchDriverApplications,
  reviewDriverApplication
} from '../services/adminApi';
import { RideStatus } from '../types';

const formatDate = (value?: string | null) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const AdminTabs = () => {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <NavLink to="/admin" end className={cls}>Driver applications</NavLink>
      <NavLink to="/admin/drivers" className={cls}>Drivers</NavLink>
      <NavLink to="/admin/parents" className={cls}>Parents</NavLink>
      <NavLink to="/admin/rides" className={cls}>Rides</NavLink>
    </div>
  );
};

const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
    <span className="flex items-start gap-2"><AlertTriangle size={18} className="mt-0.5 shrink-0" />{message}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="rounded-full bg-white px-4 py-2 font-semibold text-red-700 shadow-sm hover:bg-red-100">Retry</button>
    )}
  </div>
);

const Loading: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" />{label}</div>
);

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">{label}</div>
);

interface ConfirmState {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone: 'danger' | 'primary';
  onConfirm: () => Promise<void>;
}

const ConfirmDialog: React.FC<{ state: ConfirmState | null; onClose: () => void }> = ({ state, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [state]);

  if (!state) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await state.onConfirm();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <ConfirmModal
      open
      title={state.title}
      body={state.body}
      confirmLabel={state.confirmLabel}
      tone={state.tone}
      busy={busy}
      error={error}
      onConfirm={() => void run()}
      onClose={onClose}
    />
  );
};

/* ---------------- Driver applications ---------------- */

const applicationTabs: ApplicationStatus[] = ['pending', 'approved', 'rejected'];

const isPdf = (url: string) => /\.pdf($|\?)/i.test(url.split('#')[0]) || /application%2Fpdf|content-type=application\/pdf/i.test(url);

const DocumentTile: React.FC<{ docKey: DocumentKey; url?: string | null }> = ({ docKey, url }) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const label = DOCUMENT_LABELS[docKey];
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {!url ? (
        <p className="py-6 text-center text-sm text-slate-400">Not provided</p>
      ) : isPdf(url) || failed ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-white py-6 text-sm font-semibold text-[#1d6fff] hover:underline">
          <FileText size={18} /> Open document <ExternalLink size={14} />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="relative block">
          {!loaded && <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white text-xs text-slate-400">Loading preview...</span>}
          <img src={url} alt={label} loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="h-44 w-full rounded-xl bg-white object-contain" />
        </a>
      )}
    </div>
  );
};

const ApplicationDetailPanel: React.FC<{
  application: DriverApplicationSummary;
  onClose: () => void;
  onReviewed: (decision?: 'approved' | 'rejected') => void;
  setConfirm: (state: ConfirmState | null) => void;
}> = ({ application, onClose, onReviewed, setConfirm }) => {
  const [detail, setDetail] = useState<DriverApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchDriverApplicationDetail(application.id));
      setLoadedAt(Date.now());
    } catch (err) {
      setError(errorMessage(err, 'Could not load application.'));
    } finally {
      setLoading(false);
    }
  }, [application.id]);

  useEffect(() => {
    setNotice(null);
    void load();
  }, [load]);

  const linksMayBeExpired = loadedAt > 0 && Date.now() - loadedAt > 4.5 * 60 * 1000;
  const isPending = application.driverApplicationStatus === 'pending';

  const rejectReason = useRef('');

  const startReview = (status: 'approved' | 'rejected') => {
    if (!detail) return;
    rejectReason.current = '';
    const approve = status === 'approved';
    setConfirm({
      title: approve ? `Approve ${application.name}?` : `Reject ${application.name}?`,
      tone: approve ? 'primary' : 'danger',
      confirmLabel: approve ? 'Approve driver' : 'Reject application',
      body: approve ? (
        <>
          <p>Approving activates this driver account so they can see and accept rides with children.</p>
          <p className="rounded-xl bg-amber-50 p-3 font-medium text-amber-800">
            Only approve after the operator's real background check and document verification have been completed and passed outside this app. Reviewing the uploaded images here is not a background check.
          </p>
        </>
      ) : (
        <>
          <p>The applicant will be marked as rejected and will not be able to accept rides. They can fix their details and apply again.</p>
          <label className="block text-sm font-semibold text-slate-700">
            Reason (shown to the driver)
            <textarea maxLength={500} rows={3} onChange={(event) => { rejectReason.current = event.target.value; }} placeholder="e.g. The insurance document is unreadable. Please upload a clear photo." className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm font-normal" />
          </label>
        </>
      ),
      onConfirm: async () => {
        try {
          await reviewDriverApplication(application.id, status, detail.submittedAt, status === 'rejected' ? rejectReason.current.trim() : undefined);
          onReviewed(status);
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            setNotice(`${err.message || 'This application changed since you opened it.'} The latest version has been reloaded; please review it again.`);
            setConfirm(null);
            void load();
            onReviewed();
            return;
          }
          throw err;
        }
      }
    });
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold text-slate-950">{application.name}</h3>
          <p className="mt-1 break-all text-sm text-slate-500">{application.email}{application.phone ? ` - ${application.phone}` : ''}</p>
          <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(detail?.submittedAt ?? application.submittedAt)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close detail" className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
      </div>

      {application.vehicle && (
        <p className="mt-3 text-sm text-slate-600">
          Vehicle: {[application.vehicle.color, application.vehicle.year, application.vehicle.make, application.vehicle.model].filter(Boolean).join(' ') || 'Not provided'}
          {application.vehicle.plate ? ` (${application.vehicle.plate})` : ''}
        </p>
      )}

      {notice && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</div>}

      <div className="mt-5">
        {loading ? <Loading label="Loading documents..." /> : error ? <ErrorBox message={error} onRetry={load} /> : detail && (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Document links expire 5 minutes after loading.</span>
              <button type="button" onClick={load} className="inline-flex items-center gap-1 font-semibold text-[#1d6fff] hover:underline"><RefreshCw size={12} /> Refresh links</button>
            </div>
            {linksMayBeExpired && <p className="mb-3 text-xs font-medium text-amber-700">Links may have expired. Refresh to view documents.</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(DOCUMENT_LABELS) as DocumentKey[]).map((key) => (
                <DocumentTile key={`${key}-${loadedAt}`} docKey={key} url={detail.documents[key]} />
              ))}
            </div>
          </>
        )}
      </div>

      {isPending ? (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={!detail || loading} onClick={() => startReview('approved')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            <CheckCircle2 size={18} /> Approve
          </button>
          <button type="button" disabled={!detail || loading} onClick={() => startReview('rejected')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            <XCircle size={18} /> Reject
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">This application is <strong className="capitalize">{application.driverApplicationStatus}</strong>.</p>
      )}
    </div>
  );
};

export const AdminApplications = () => {
  const [status, setStatus] = useState<ApplicationStatus>('pending');
  const [items, setItems] = useState<DriverApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DriverApplicationSummary | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Switching tabs while a slow request is in flight must not let the old reply win.
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDriverApplications(status);
      if (request === latestRequest.current) setItems(result);
    } catch (err) {
      if (request === latestRequest.current) setError(errorMessage(err, 'Could not load driver applications.'));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setSelected(null);
    void load();
  }, [load]);

  return (
    <div>
      <AdminTabs />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {applicationTabs.map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={status === tab} onClick={() => { setFlash(null); setStatus(tab); }}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${status === tab ? 'bg-[#1d6fff] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {tab}
            </button>
          ))}
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><RefreshCw size={16} /> Refresh</button>
      </div>

      {flash && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash}</div>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr),minmax(0,1.4fr)]">
        <div>
          {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={load} /> : items.length === 0 ? (
            <Empty label={`No ${status} applications.`} />
          ) : (
            <ul className="space-y-2">
              {items.map((app) => (
                <li key={app.id}>
                  <button type="button" onClick={() => setSelected(app)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selected?.id === app.id ? 'border-[#1d6fff] bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <p className="font-semibold text-slate-950">{app.name}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{app.email}</p>
                    <p className="mt-1 text-xs text-slate-400">Submitted {formatDate(app.submittedAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {selected ? (
            <ApplicationDetailPanel
              key={selected.id}
              application={selected}
              onClose={() => setSelected(null)}
              setConfirm={setConfirm}
              onReviewed={(decision) => {
                if (decision) {
                  setFlash(`${selected.name} was ${decision}.`);
                  setSelected(null);
                }
                void load();
              }}
            />
          ) : (
            <Empty label="Select an application to view documents." />
          )}
        </div>
      </div>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

/* ---------------- Rides ---------------- */

const scopes: RideScope[] = ['active', 'upcoming', 'past', 'all'];
const allStatuses = Object.values(RideStatus) as RideStatus[];

export const AdminRides = () => {
  const [scope, setScope] = useState<RideScope>('active');
  const [statusFilter, setStatusFilter] = useState<RideStatus | 'any'>('any');
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [overrideChoice, setOverrideChoice] = useState<Record<string, RideStatus>>({});
  const [flash, setFlash] = useState<string | null>(null);

  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminRides(scope, 100);
      if (request === latestRequest.current) setRides(result);
    } catch (err) {
      if (request === latestRequest.current) setError(errorMessage(err, 'Could not load rides.'));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  const visible = statusFilter === 'any' ? rides : rides.filter((ride) => ride.status === statusFilter);

  const askCancel = (ride: AdminRide) => setConfirm({
    title: 'Cancel this ride?',
    tone: 'danger',
    confirmLabel: 'Cancel ride',
    body: (
      <>
        <p>Ride {ride.tripCode ? <strong>{ride.tripCode}</strong> : ride.id} is currently <strong>{ride.status.replace(/_/g, ' ')}</strong>.</p>
        {ride.status === RideStatus.IN_PROGRESS && (
          <p className="rounded-xl bg-amber-50 p-3 font-medium text-amber-800">The child has already been picked up. Make sure the parent and driver have been contacted and the child's safety is confirmed before cancelling.</p>
        )}
        <p>Cancelled rides cannot be reopened.</p>
      </>
    ),
    onConfirm: async () => {
      await adminCancelRide(ride.id);
      setFlash('Ride cancelled.');
      await load();
    }
  });

  const askOverride = (ride: AdminRide) => {
    const target = overrideChoice[ride.id];
    if (!target || target === ride.status) return;
    setConfirm({
      title: 'Override ride status?',
      tone: TERMINAL_RIDE_STATUSES.includes(target) ? 'danger' : 'primary',
      confirmLabel: 'Set status',
      body: (
        <>
          <p>Change status from <strong>{ride.status.replace(/_/g, ' ')}</strong> to <strong>{target.replace(/_/g, ' ')}</strong>.</p>
          <p>This bypasses the normal driver flow. Parents and drivers will see the new status.</p>
          {TERMINAL_RIDE_STATUSES.includes(target) && <p className="font-medium text-red-700">This is a final status; the ride cannot be reopened afterwards.</p>}
        </>
      ),
      onConfirm: async () => {
        await adminOverrideRideStatus(ride.id, target);
        setFlash('Ride status updated.');
        await load();
      }
    });
  };

  return (
    <div>
      <AdminTabs />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <button key={s} type="button" onClick={() => { setFlash(null); setScope(s); }}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${scope === s ? 'bg-[#1d6fff] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {s}
            </button>
          ))}
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(['any', ...allStatuses] as const).map((s) => {
          const count = s === 'any' ? rides.length : rides.filter((r) => r.status === s).length;
          return (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${statusFilter === s ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s === 'any' ? 'All statuses' : s.replace(/_/g, ' ')} ({count})
            </button>
          );
        })}
      </div>

      {flash && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash}</div>}

      {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={load} /> : visible.length === 0 ? (
        <Empty label="No rides match these filters." />
      ) : (
        <ul className="space-y-3">
          {visible.map((ride) => {
            const terminal = TERMINAL_RIDE_STATUSES.includes(ride.status);
            return (
              <li key={ride.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={ride.status} />
                      <span className="text-xs font-semibold uppercase text-slate-400">{ride.serviceType.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold text-slate-950">{ride.pickupLocation || 'Unknown pickup'} &rarr; {ride.dropoffLocation || 'Unknown drop-off'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Pickup {formatDate(ride.pickupTime)}
                      {ride.childName ? ` - Child: ${ride.childName}` : ''}
                      {ride.parentName ? ` - Parent: ${ride.parentName}` : ''}
                      {` - Driver: ${ride.driver?.name || (ride.driverId ? ride.driverId : 'unassigned')}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">ID {ride.id}{ride.tripCode ? ` - Trip code ${ride.tripCode}` : ''}</p>
                  </div>
                  {!terminal && (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <select
                        aria-label="Override status"
                        value={overrideChoice[ride.id] || ride.status}
                        onChange={(e) => setOverrideChoice((prev) => ({ ...prev, [ride.id]: e.target.value as RideStatus }))}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        {allStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                      <button type="button" disabled={!overrideChoice[ride.id] || overrideChoice[ride.id] === ride.status} onClick={() => askOverride(ride)}
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Set status</button>
                      <button type="button" onClick={() => askCancel(ride)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">Cancel ride</button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !error && rides.length >= 100 && <p className="mt-4 text-xs text-slate-500">Showing the first 100 rides for this scope.</p>}

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

// --- Drivers and parents ---

const formatDay = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const ratingLabel = (rating?: RatingSummary) => (rating?.count && rating.average !== null ? `★ ${rating.average.toFixed(1)} (${rating.count} ${rating.count === 1 ? 'rating' : 'ratings'})` : 'No ratings yet');

const Detail: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-0.5 text-sm font-medium text-slate-800">{value}</dd></div>
);

const PAGE_SIZE = 20;

const vehicleText = (user: ManagedUser) => {
  const text = [user.vehicle?.color, user.vehicle?.year, user.vehicle?.make, user.vehicle?.model].filter(Boolean).join(' ');
  return text ? `${text}${user.vehicle?.plate ? ` (${user.vehicle.plate})` : ''}` : 'Not provided';
};

const applicationLabel = (status?: string) => (status === 'none' || !status ? 'Not applied' : status === 'rejected' ? 'Not approved' : status === 'approved' ? 'Approved' : 'Pending');

const ManagedUsersPage: React.FC<{ role: 'driver' | 'parent' }> = ({ role }) => {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ManagedUserPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ManagedUser | null>(null);
  const reason = useRef('');
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchManagedUsers(role, { search, page, pageSize: PAGE_SIZE });
      if (request === latestRequest.current) setData(result);
    } catch (err) {
      if (request === latestRequest.current) setError(errorMessage(err, `Could not load ${role}s.`));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [role, search, page]);

  useEffect(() => { void load(); }, [load]);

  const reasonField = (label: string, placeholder: string) => (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea maxLength={500} rows={3} placeholder={placeholder} onChange={(event) => { reason.current = event.target.value; }} className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm font-normal" />
    </label>
  );

  const requireReason = () => {
    const value = reason.current.trim();
    if (!value) throw new Error('Please enter a reason.');
    return value;
  };

  const askBlock = (user: ManagedUser) => {
    reason.current = '';
    setConfirm({
      title: `Block ${user.name}?`,
      tone: 'danger',
      confirmLabel: 'Block account',
      body: (
        <>
          <p>They are signed out on every device straight away and cannot log in until you unblock them.</p>
          {reasonField('Reason (internal)', 'e.g. Reported unsafe driving on 20 Oct')}
        </>
      ),
      onConfirm: async () => {
        await blockUser(user.id, requireReason());
        setFlash(`${user.name} was blocked.`);
        void load();
      }
    });
  };

  const askUnblock = (user: ManagedUser) => setConfirm({
    title: `Unblock ${user.name}?`,
    tone: 'primary',
    confirmLabel: 'Unblock account',
    body: <p>They will be able to log in again.{role === 'driver' ? ' Their driver approval is unchanged.' : ''}</p>,
    onConfirm: async () => {
      await unblockUser(user.id);
      setFlash(`${user.name} was unblocked.`);
      void load();
    }
  });

  const askRevoke = (user: ManagedUser) => {
    reason.current = '';
    setConfirm({
      title: `Revoke ${user.name}'s driver approval?`,
      tone: 'danger',
      confirmLabel: 'Revoke approval',
      body: (
        <>
          <p>They stop receiving ride offers immediately. Their application is marked "Not approved" and they can apply again.</p>
          {reasonField('Reason (shown to the driver)', 'e.g. Insurance has expired. Please upload a current policy.')}
        </>
      ),
      onConfirm: async () => {
        await revokeDriverApproval(user.id, requireReason());
        setFlash(`${user.name}'s approval was revoked.`);
        void load();
      }
    });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const noun = role === 'driver' ? 'drivers' : 'parents';

  return (
    <div>
      <AdminTabs />
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setFlash(null);
          // Same search and page: reload anyway so Search always shows fresh data.
          if (searchInput === search && page === 1) void load();
          else { setPage(1); setSearch(searchInput); }
        }}
      >
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={`Search ${noun} by name or email`} className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm" />
        <button type="submit" className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Search</button>
        <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-950"><RefreshCw size={16} /> Refresh</button>
      </form>
      {flash && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{flash}</div>}
      {data && (
        <p className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{data.total} {noun}{search ? ` matching "${search}"` : ''}</span>
          {role === 'driver' && data.onlineCount !== undefined && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />{data.onlineCount} online now</span>
          )}
        </p>
      )}

      {loading && !data ? <Loading label={`Loading ${noun}...`} /> : error ? <ErrorBox message={error} onRetry={load} /> : !data?.users.length ? <Empty label={`No ${noun} found.`} /> : (
        <div className="space-y-3">
          {data.users.map((user) => {
            const approved = user.driverApplicationStatus === 'approved';
            return (
              <div key={user.id} className={`rounded-3xl border bg-white p-5 shadow-sm ${user.isBlocked ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-slate-950">{user.name}</p>
                    <p className="break-all text-sm text-slate-500">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.isBlocked && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Blocked</span>}
                    {role === 'driver' && user.driverApplicationStatus === 'approved' && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${user.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`} title={user.lastOnlineAt ? `Last seen ${new Date(user.lastOnlineAt).toLocaleString()}` : 'Not seen online yet'}>
                        <span className={`h-2 w-2 rounded-full ${user.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />{user.isOnline ? 'Online' : 'Offline'}
                      </span>
                    )}
                    {role === 'driver' && (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${approved ? 'bg-emerald-100 text-emerald-700' : user.driverApplicationStatus === 'pending' ? 'bg-amber-100 text-amber-700' : user.driverApplicationStatus === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                        {applicationLabel(user.driverApplicationStatus)}
                      </span>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Phone" value={user.phone || 'Not added'} />
                  <Detail label="Joined" value={formatDay(user.joinedAt) || 'Unknown'} />
                  {role === 'driver' ? (
                    <>
                      <Detail label="Vehicle" value={vehicleText(user)} />
                      <Detail label="Rating" value={ratingLabel(user.rating)} />
                      <Detail label="Completed rides" value={user.completedRides ?? 0} />
                      <Detail label="Applied" value={formatDay(user.submittedAt) || 'Not yet'} />
                      <Detail label={approved ? 'Approved' : 'Last decision'} value={formatDay(user.reviewedAt) || (approved ? 'Date not recorded' : 'None yet')} />
                    </>
                  ) : (
                    <>
                      <Detail label="Children" value={user.children ?? 0} />
                      <Detail label="Rides booked" value={user.rides ?? 0} />
                    </>
                  )}
                </dl>
                {user.reviewNote && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">Review note: {user.reviewNote}</p>}
                {user.isBlocked && user.blockedReason && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-xs text-red-700">Blocked{formatDay(user.blockedAt) ? ` on ${formatDay(user.blockedAt)}` : ''}: {user.blockedReason}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {role === 'driver' && user.submittedAt && (
                    <button type="button" onClick={() => setViewing(user)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">View documents</button>
                  )}
                  {role === 'driver' && approved && (
                    <button type="button" onClick={() => askRevoke(user)} className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">Revoke approval</button>
                  )}
                  {user.isBlocked ? (
                    <button type="button" onClick={() => askUnblock(user)} className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">Unblock</button>
                  ) : (
                    <button type="button" onClick={() => askBlock(user)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">Block</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} className="rounded-full border border-slate-200 px-4 py-2 font-semibold disabled:opacity-40">Previous</button>
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)} className="rounded-full border border-slate-200 px-4 py-2 font-semibold disabled:opacity-40">Next</button>
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} maxWidth="max-w-4xl" labelledBy="driver-documents">
        {viewing && (
          <ApplicationDetailPanel
            application={{ id: viewing.id, name: viewing.name, email: viewing.email, phone: viewing.phone || '', vehicle: viewing.vehicle, driverApplicationStatus: viewing.driverApplicationStatus || 'none', submittedAt: viewing.submittedAt || null }}
            onClose={() => setViewing(null)}
            onReviewed={() => { setViewing(null); void load(); }}
            setConfirm={setConfirm}
          />
        )}
      </Modal>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
};

export const AdminDrivers = () => <ManagedUsersPage role="driver" />;
export const AdminParents = () => <ManagedUsersPage role="parent" />;
