import React, { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Input } from '../components/UIComponents';
import { BrandLockup } from '../components/brand/BrandLockup';
import { ApiError, apiRequest } from '../services/api';

// Forgot password: ask for a reset link by email, then (from the link) choose a new password.
export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (token && password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = token
        ? await apiRequest<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, password } })
        : await apiRequest<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email } });
      setDone(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'KidRide could not be reached. Try again in a moment.');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand via-brand-deep to-ink px-4 py-10">
      <section className="w-full max-w-md rounded-[32px] bg-white p-6 text-gray-900 shadow-[0_32px_80px_rgba(7,20,60,0.35)]">
        <div className="mb-6"><BrandLockup size={56} /></div>
        <h1 className="text-xl font-bold">{token ? 'Choose a new password' : 'Forgot your password?'}</h1>
        {done ? (
          <>
            <p role="status" className="mt-4 text-sm text-slate-600">{done}</p>
            <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-brand-deep underline">Back to log in</Link>
          </>
        ) : (
          <form className="mt-4 space-y-2" onSubmit={submit}>
            {token ? (
              <>
                <Input label="New password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
                <Input label="Repeat new password" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
                <p className="text-xs text-slate-500">At least 8 characters. You will be signed out on every device.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">Enter the email you signed up with. We will send a link to choose a new password.</p>
                <Input label="Email Address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </>
            )}
            {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
            <Button type="submit" fullWidth disabled={busy}>{busy ? 'Please wait...' : token ? 'Save new password' : 'Send reset link'}</Button>
            <Link to="/login" className="block pt-2 text-center text-sm font-semibold text-brand-deep">Back to log in</Link>
          </form>
        )}
      </section>
    </div>
  );
};

export default ResetPassword;
