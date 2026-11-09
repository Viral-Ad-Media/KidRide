import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Camera, Car, ChevronRight, Clock, CreditCard, Loader2, MapPin, ScanFace, ShieldCheck, XCircle } from 'lucide-react';
import { Button, Card } from '../components/UIComponents';
import { LivenessCheck } from '../components/verification/LivenessCheck';
import { PhotoCheck } from '../components/verification/PhotoCheck';
import { CHECK_HELP, CHECK_LABELS, CheckKind, DriverCheck, IdentityState, fetchMyChecks, refreshIdentity, startIdentity } from '../services/driverChecks';

// Driver: identity verification and any checks KidRide has asked for. While a
// check is open the driver cannot go online or accept new rides.

const ICONS: Record<CheckKind, typeof Camera> = { identity: CreditCard, liveness: ScanFace, id_document: CreditCard, vehicle_photo: Car, plate_photo: Camera, location_photo: MapPin };

const IDENTITY_TEXT: Record<IdentityState['status'], string> = {
  none: 'Not verified yet',
  pending: 'Started. Finish the steps with our ID partner.',
  processing: 'Checking your licence and selfie. This usually takes a minute or two.',
  requires_input: 'We could not verify you. Try again with a clear photo of your licence and good light on your face.',
  verified: 'Verified'
};

const statusChip = (check: DriverCheck) => {
  if (check.status === 'pending') return <span className="rounded-full bg-warning/15 px-3 py-1 text-caption font-semibold text-ink">To do</span>;
  if (check.status === 'submitted') return <span className="rounded-full bg-surface-2 px-3 py-1 text-caption font-semibold text-muted">{check.clears === 'submit' ? 'Sent' : 'Being reviewed'}</span>;
  if (check.status === 'passed') return <span className="rounded-full bg-success/10 px-3 py-1 text-caption font-semibold text-success">Passed</span>;
  if (check.status === 'failed') return <span className="rounded-full bg-danger/10 px-3 py-1 text-caption font-semibold text-danger">Not passed</span>;
  return <span className="rounded-full bg-surface-2 px-3 py-1 text-caption font-semibold text-muted">Cancelled</span>;
};

export const DriverVerification = () => {
  const [data, setData] = useState<{ identity: IdentityState; checks: DriverCheck[]; blocked: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<DriverCheck | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await fetchMyChecks()); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load your verification.'); }
  }, []);

  // Back from the ID partner, or still processing: ask for the latest result.
  useEffect(() => {
    void (async () => {
      try { await refreshIdentity(); } catch { /* shown by load */ }
      await load();
    })();
  }, [load]);
  useEffect(() => {
    if (data?.identity.status !== 'processing') return undefined;
    const timer = setInterval(() => { void refreshIdentity().then(load).catch(() => undefined); }, 10000);
    return () => clearInterval(timer);
  }, [data?.identity.status, load]);

  const beginIdentity = async () => {
    setBusy(true); setError(null);
    try { window.location.assign((await startIdentity()).url); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not start ID verification.'); setBusy(false); }
  };

  const finish = () => { setActive(null); void load(); };

  if (active) {
    return (
      <div className="mx-auto max-w-xl">
        <h2 className="mb-1 text-title font-extrabold tracking-tight">{CHECK_LABELS[active.kind]}</h2>
        <p className="mb-5 text-label text-muted">{active.reasonLabel}</p>
        {active.kind === 'liveness'
          ? <LivenessCheck checkId={active.id} onDone={finish} onCancel={() => setActive(null)} />
          : <PhotoCheck checkId={active.id} kind={active.kind} onDone={finish} onCancel={() => setActive(null)} />}
      </div>
    );
  }

  if (!data) {
    return error
      ? <p role="alert" className="text-label text-danger">{error}</p>
      : <p className="flex items-center gap-2 text-label text-muted"><Loader2 size={16} className="animate-spin" />Loading verification...</p>;
  }

  const open = data.checks.filter((c) => ['pending', 'failed'].includes(c.status) || (c.status === 'submitted' && c.blocksDriving));
  const history = data.checks.filter((c) => !open.includes(c)).slice(0, 8);
  const identityNeeded = data.checks.some((c) => c.kind === 'identity' && c.status === 'pending');
  const { identity } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-label text-muted">Parents trust KidRide because every driver is who they say they are. We may ask you to verify again from time to time.</p>
      </div>

      {data.blocked ? (
        <p role="alert" className="flex items-start gap-2 rounded-card bg-warning/15 px-4 py-3 text-label text-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          Finish the checks below to go online and take new rides. Rides you already have are not affected.
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-card bg-success/10 px-4 py-3 text-label font-semibold text-success"><ShieldCheck size={18} />You are all set.</p>
      )}

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <BadgeCheck className={identity.status === 'verified' ? 'text-success' : 'text-muted'} size={24} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">ID and selfie</p>
            <p className="text-label text-muted">{identity.providerReady ? IDENTITY_TEXT[identity.status] : 'ID verification with our partner is not switched on yet. KidRide reviews your licence and face photos instead.'}</p>
            {identity.verifiedAt && <p className="mt-1 text-caption text-muted">Verified {new Date(identity.verifiedAt).toLocaleDateString()}</p>}
            {identity.error?.reason && identity.status === 'requires_input' && <p className="mt-1 text-caption text-danger">{identity.error.reason}</p>}
          </div>
        </div>
        {identity.providerReady && (identityNeeded || identity.status !== 'verified') && identity.status !== 'processing' && (
          <Button className="mt-4" fullWidth onClick={() => void beginIdentity()} disabled={busy}>
            {busy ? 'Opening...' : identity.status === 'none' || identity.status === 'verified' ? 'Verify my ID' : 'Try again'}
          </Button>
        )}
        {identity.providerReady && identity.status !== 'verified' && <p className="mt-3 text-caption text-muted">{CHECK_HELP.identity} You will come back here when you are done.</p>}
      </Card>

      {open.filter((c) => c.kind !== 'identity').length > 0 && (
        <section>
          <h2 className="mb-3 text-title font-bold">To do</h2>
          <div className="space-y-2">
            {open.filter((c) => c.kind !== 'identity').map((check) => {
              const Icon = ICONS[check.kind];
              const canStart = check.status === 'pending';
              return (
                <button key={check.id} type="button" disabled={!canStart} onClick={() => setActive(check)}
                  className="flex w-full items-center gap-3 rounded-card border border-line bg-white p-4 text-left transition enabled:hover:bg-surface disabled:cursor-default">
                  <Icon size={22} className="shrink-0 text-brand-deep" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{CHECK_LABELS[check.kind]}</span>
                    <span className="block text-caption text-muted">{check.status === 'failed' ? (check.reviewNote || 'Not accepted. KidRide support will contact you.') : check.reasonLabel}</span>
                  </span>
                  {statusChip(check)}
                  {canStart && <ChevronRight size={18} className="text-muted" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-title font-bold">Recent</h2>
          <ul className="divide-y divide-line rounded-card border border-line bg-white">
            {history.map((check) => (
              <li key={check.id} className="flex items-center gap-3 px-4 py-3 text-label">
                {check.status === 'passed' ? <ShieldCheck size={18} className="text-success" /> : check.status === 'failed' ? <XCircle size={18} className="text-danger" /> : <Clock size={18} className="text-muted" />}
                <span className="flex-1">{CHECK_LABELS[check.kind]} <span className="text-muted">· {new Date(check.createdAt).toLocaleDateString()}</span></span>
                {statusChip(check)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p role="alert" className="text-label text-danger">{error}</p>}
      <Link to="/driver-dashboard" className="inline-block text-label font-semibold text-brand-deep underline">Back to jobs</Link>
    </div>
  );
};
