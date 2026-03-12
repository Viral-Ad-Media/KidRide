import React, { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/UIComponents';
import { ShieldCheck, Heart, Car, UserPlus, LogIn } from 'lucide-react';
import { getDefaultRouteForUser, useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';
import { UserRole } from '../types';

type AuthMode = 'login' | 'signup';

const roleOptions = [
  {
    role: UserRole.PARENT,
    label: 'Parent',
    description: 'Book rides, add children, and track every trip.',
    icon: Heart
  },
  {
    role: UserRole.DRIVER,
    label: 'Driver',
    description: 'Create your account and continue into driver verification.',
    icon: Car
  }
];

const publicLinks = [
  { path: '/about', label: 'About' },
  { path: '/help', label: 'Help' },
  { path: '/contact', label: 'Contact' },
  { path: '/privacy', label: 'Privacy' },
  { path: '/terms', label: 'Terms' }
];

export const Welcome = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.PARENT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const isSignup = mode === 'signup';

  const updateForm = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (isSignup && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const authenticatedUser = isSignup
        ? await register({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: selectedRole
          })
        : await login({
            email: formData.email,
            password: formData.password
          });

      navigate(getDefaultRouteForUser(authenticatedUser));
    } catch (authError) {
      setError(authError instanceof ApiError ? authError.message : 'Unable to complete authentication right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#7cc7ff_0%,#3A77FF_32%,#123a9b_100%)] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 lg:flex-row lg:items-center lg:gap-16">
        <section className="max-w-xl">
          <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-[28px] bg-white/15 backdrop-blur-xl">
            <ShieldCheck size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">KidRide</h1>
          <p className="mt-4 max-w-lg text-lg text-white/82">
            Real parent and driver accounts backed by the API, with session restore and protected app routes.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-xl">
              <p className="text-sm font-semibold text-white">Parents</p>
              <p className="mt-2 text-sm text-white/75">
                Sign up, add your children, and request rides without relying on seeded demo credentials.
              </p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-slate-950/20 p-5 backdrop-blur-xl">
              <p className="text-sm font-semibold text-white">Drivers</p>
              <p className="mt-2 text-sm text-white/75">
                Create an account, finish verification, and come back with the same login later.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-md rounded-[32px] bg-white p-6 text-gray-900 shadow-[0_32px_80px_rgba(7,20,60,0.35)]">
          <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleModeChange('login')}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                mode === 'login' ? 'bg-white text-[#1A1D26] shadow-sm' : 'text-slate-500'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <LogIn size={16} />
                Log In
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('signup')}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                mode === 'signup' ? 'bg-white text-[#1A1D26] shadow-sm' : 'text-slate-500'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus size={16} />
                Sign Up
              </span>
            </button>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            {roleOptions.map(({ role, label, description, icon: Icon }) => {
              const active = selectedRole === role;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setSelectedRole(role);
                    setError(null);
                  }}
                  className={`rounded-3xl border p-4 text-left transition ${
                    active ? 'border-[#3A77FF] bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-[#3A77FF]">
                    <Icon size={20} className={role === UserRole.PARENT ? 'fill-current' : ''} />
                  </div>
                  <p className="font-semibold text-slate-900">{label}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
                </button>
              );
            })}
          </div>

          <form className="space-y-2" onSubmit={handleSubmit}>
            {isSignup && (
              <Input
                label="Full Name"
                placeholder={selectedRole === UserRole.DRIVER ? 'e.g. Taylor Brooks' : 'e.g. Jordan Lee'}
                value={formData.name}
                onChange={(event) => updateForm('name', event.target.value)}
                autoComplete="name"
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(event) => updateForm('email', event.target.value)}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder={isSignup ? 'Create a secure password' : 'Enter your password'}
              value={formData.password}
              onChange={(event) => updateForm('password', event.target.value)}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
            />

            {isSignup && (
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Repeat your password"
                value={formData.confirmPassword}
                onChange={(event) => updateForm('confirmPassword', event.target.value)}
                autoComplete="new-password"
                required
              />
            )}

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {isSignup && selectedRole === UserRole.DRIVER
                ? 'After account creation, you will continue into the driver verification application.'
                : 'We route you based on the actual account returned by the backend after authentication.'}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button fullWidth type="submit" disabled={loading}>
              {loading
                ? (isSignup ? 'Creating account...' : 'Signing in...')
                : (isSignup
                    ? (selectedRole === UserRole.DRIVER ? 'Create Driver Account' : 'Create Parent Account')
                    : 'Continue')}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <p className="text-sm text-slate-500">
              {isSignup ? 'Already have an account?' : 'Need a new account?'}
            </p>
            <button
              type="button"
              onClick={() => handleModeChange(isSignup ? 'login' : 'signup')}
              className="mt-2 text-sm font-semibold text-[#3A77FF]"
            >
              {isSignup ? 'Switch to Log In' : 'Switch to Sign Up'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/drive')}
              className="mt-4 block w-full text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Learn more about driving with KidRide
            </button>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
              {publicLinks.map((link) => (
                <Link key={link.path} to={link.path} className="transition hover:text-slate-600">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
