import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Car,
  CreditCard,
  DollarSign,
  HelpCircle,
  Home,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Plus,
  Shield,
  User,
  X
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

type NavItem = {
  icon: typeof Home;
  label: string;
  path: string;
  description: string;
};

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Family Dashboard',
    subtitle: 'See child profiles, current rides, and your next actions in one place.'
  },
  '/add-child': {
    title: 'Add Child Profile',
    subtitle: 'Create a real child profile before booking any ride.'
  },
  '/book': {
    title: 'Book a Ride',
    subtitle: 'Plan a trip with clear pickup details and a verified driver flow.'
  },
  '/carpools': {
    title: 'Carpools',
    subtitle: 'Browse community ride options and shared family transportation.'
  },
  '/rides': {
    title: 'Ride History',
    subtitle: 'Track active trips, upcoming bookings, and completed rides.'
  },
  '/tracking/:id': {
    title: 'Live Tracking',
    subtitle: 'Follow trip progress, trip code, and safety details in real time.'
  },
  '/safety': {
    title: 'Safety Assistant',
    subtitle: 'Get support guidance and quick answers while coordinating rides.'
  },
  '/profile': {
    title: 'Profile & Settings',
    subtitle: 'Manage your account, verification status, and preferences.'
  },
  '/profile/notifications': {
    title: 'Notifications',
    subtitle: 'Choose how KidRide keeps you up to date on ride activity.'
  },
  '/profile/payments': {
    title: 'Payments',
    subtitle: 'Keep payment methods and billing details organized.'
  },
  '/driver-dashboard': {
    title: 'Driver Console',
    subtitle: 'Review open jobs, active trips, and driver readiness at a glance.'
  },
  '/driver-map': {
    title: 'Driver Map',
    subtitle: 'See the service area and stay oriented while driving.'
  },
  '/earnings': {
    title: 'Earnings',
    subtitle: 'Track performance and income from completed rides.'
  }
};

const resolveRouteKey = (pathname: string) => {
  if (pathname.startsWith('/tracking/')) {
    return '/tracking/:id';
  }

  return pathname;
};

const userInitials = (name: string | undefined) => {
  if (!name) {
    return 'KR';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const publicPagePaths = new Set([
    '/',
    '/about',
    '/help',
    '/contact',
    '/privacy',
    '/terms',
    '/drive',
    '/driver-signup'
  ]);

  if (publicPagePaths.has(location.pathname)) {
    return <div className="min-h-screen text-slate-900">{children}</div>;
  }

  const parentNavItems: NavItem[] = [
    { icon: Home, label: 'Dashboard', path: '/dashboard', description: 'Overview and family activity' },
    { icon: Car, label: 'Rides', path: '/rides', description: 'Trips, bookings, and history' },
    { icon: MessageCircle, label: 'Safety', path: '/safety', description: 'Support guidance and help' },
    { icon: User, label: 'Profile', path: '/profile', description: 'Account and preferences' }
  ];

  const driverNavItems: NavItem[] = [
    { icon: Briefcase, label: 'Jobs', path: '/driver-dashboard', description: 'Open jobs and active rides' },
    { icon: Map, label: 'Map', path: '/driver-map', description: 'Service area and location' },
    { icon: DollarSign, label: 'Earnings', path: '/earnings', description: 'Performance and payouts' },
    { icon: User, label: 'Profile', path: '/profile', description: 'Account and verification' }
  ];

  const navItems = user?.role === UserRole.DRIVER ? driverNavItems : parentNavItems;
  const routeKey = resolveRouteKey(location.pathname);
  const activeNavItem = navItems.find((item) => location.pathname === item.path);
  const page = routeMeta[routeKey] || {
    title: activeNavItem?.label || 'KidRide',
    subtitle: user?.role === UserRole.DRIVER
      ? 'Manage your driver account and live trip state from a single workspace.'
      : 'Manage rides, children, and account settings from one place.'
  };

  const primaryAction = user?.role === UserRole.DRIVER
    ? {
        label: 'View Driver Map',
        path: '/driver-map',
        icon: Map,
        helper: 'Keep your service area and routing tools close by.'
      }
    : (user?.children?.length || 0) > 0
      ? {
          label: 'Book a Ride',
          path: '/book',
          icon: Car,
          helper: 'Move quickly from planning into live ride tracking.'
        }
      : {
          label: 'Add a Child',
          path: '/add-child',
          icon: Plus,
          helper: 'Create your first child profile before booking a ride.'
        };

  const accountSummary = useMemo(() => {
    if (user?.role === UserRole.DRIVER) {
      const applicationStatus = user.driverApplicationStatus || 'none';
      const driverLabel = applicationStatus === 'approved'
        ? 'Verified driver'
        : applicationStatus === 'pending'
          ? 'Verification pending'
          : 'Driver account';

      return {
        eyebrow: 'Driver Workspace',
        label: driverLabel,
        meta: 'Jobs, trip flow, and account readiness'
      };
    }

    const childCount = user?.children?.length || 0;
    return {
      eyebrow: 'Family Hub',
      label: childCount > 0 ? `${childCount} child ${childCount === 1 ? 'profile' : 'profiles'}` : 'No child profiles yet',
      meta: 'Bookings, safety, and family coordination'
    };
  }, [user]);

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const renderAvatar = () => (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#dbeafe_0%,#bfdbfe_100%)] text-sm font-bold text-[#1447b8] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      {user?.photoUrl ? <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" /> : userInitials(user?.name)}
    </div>
  );

  const secondaryActions = [
    { icon: Shield, label: 'Verification', path: '/profile' },
    { icon: CreditCard, label: 'Payments', path: '/profile/payments' },
    { icon: HelpCircle, label: 'Help', path: '/help' }
  ];

  const ActionIcon = primaryAction.icon;

  return (
    <div className="min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-7rem] h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-64 w-64 rounded-full bg-amber-200/35 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-blue-200/25 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] gap-4 px-3 py-3 sm:gap-5 sm:px-5 sm:py-5 xl:gap-6 xl:px-6">
        <aside className="hidden xl:flex xl:w-[310px] xl:shrink-0">
          <div className="glass-panel sticky top-5 flex h-[calc(100vh-2.5rem)] w-full flex-col overflow-hidden rounded-[32px] p-6">
            <button
              type="button"
              onClick={() => navigate(user?.role === UserRole.DRIVER ? '/driver-dashboard' : '/dashboard')}
              className="flex items-center gap-4 rounded-[24px] border border-white/60 bg-white/70 px-4 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:bg-white/85"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#0f3ea8_0%,#1d6fff_58%,#7cc7ff_100%)] text-white shadow-[0_14px_28px_rgba(29,111,255,0.22)]">
                <Car size={22} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700/80">KidRide</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">Workspace</p>
              </div>
            </button>

            <div className="mt-5 flex items-center gap-4 rounded-[28px] border border-white/60 bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              {renderAvatar()}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-950">{user?.name || 'KidRide User'}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700/85">{accountSummary.eyebrow}</p>
                <p className="mt-2 text-xs text-slate-500">{accountSummary.label}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleNavigation(item.path)}
                    className={`flex w-full items-center gap-4 rounded-[22px] px-4 py-4 text-left transition-all ${
                      isActive
                        ? 'bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]'
                        : 'bg-transparent text-slate-600 hover:bg-white/80 hover:text-slate-950'
                    }`}
                  >
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-[16px] ${
                      isActive ? 'bg-white/12 text-white' : 'bg-slate-100 text-[#1d6fff]'
                    }`}>
                      <item.icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{item.label}</p>
                      <p className={`mt-1 text-xs ${isActive ? 'text-white/68' : 'text-slate-400'}`}>{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(239,246,255,0.92)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-blue-50 text-[#1d6fff]">
                  <ActionIcon size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{primaryAction.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{primaryAction.helper}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleNavigation(primaryAction.path)}
                className="mt-4 flex w-full items-center justify-between rounded-[20px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <span>Open</span>
                <span className="text-white/55">/</span>
              </button>
            </div>

            <div className="mt-auto space-y-2 pt-6">
              {secondaryActions.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNavigation(item.path)}
                  className="flex w-full items-center gap-4 rounded-[20px] px-4 py-3 text-left text-slate-600 transition hover:bg-white/80 hover:text-slate-950"
                >
                  <item.icon size={18} className="text-slate-400" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex w-full items-center gap-4 rounded-[20px] bg-red-50 px-4 py-3 text-left text-red-600 transition hover:bg-red-100"
              >
                <LogOut size={18} />
                <span className="text-sm font-semibold">Log Out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4 xl:gap-5">
          <header className="glass-panel sticky top-3 z-40 rounded-[30px] px-4 py-4 sm:px-6 xl:top-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 xl:hidden">
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                    aria-label="Open menu"
                  >
                    <Menu size={20} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700/80">{accountSummary.eyebrow}</p>
                    <h2 className="truncate text-2xl font-bold text-slate-950">{page.title}</h2>
                  </div>
                </div>

                <div className="hidden xl:block">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700/80">{accountSummary.eyebrow}</p>
                  <h2 className="mt-1 text-3xl font-bold text-slate-950">{page.title}</h2>
                </div>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{page.subtitle}</p>
              </div>

              <div className="hidden min-w-[260px] items-center justify-end gap-3 sm:flex">
                <div className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-3 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workspace Status</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{accountSummary.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{accountSummary.meta}</p>
                </div>
                {renderAvatar()}
              </div>
            </div>
          </header>

          <main className="flex-1 pb-28 xl:pb-6">
            <div className="glass-panel min-h-full rounded-[34px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
              <div className="mx-auto w-full max-w-[1180px]">
                {children}
              </div>
            </div>
          </main>
        </div>

        <nav className="glass-panel fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-[28px] px-3 py-2 xl:hidden">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[18px] px-2 py-2 text-center transition ${
                  isActive ? 'bg-slate-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)]' : 'text-slate-400'
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[11px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {isMenuOpen && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <div
              className="absolute inset-0 bg-slate-950/38 backdrop-blur-sm"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-[86vw] max-w-sm p-3 sm:p-4">
              <div className="glass-panel flex h-full flex-col rounded-[30px] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700/80">{accountSummary.eyebrow}</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-950">Menu</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-100 text-slate-700"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mt-6 flex items-center gap-4 rounded-[24px] border border-white/60 bg-white/75 p-4">
                  {renderAvatar()}
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-950">{user?.name || 'KidRide User'}</p>
                    <p className="mt-1 text-xs text-slate-500">{accountSummary.label}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleNavigation(item.path)}
                        className={`flex w-full items-center gap-4 rounded-[22px] px-4 py-4 text-left transition ${
                          isActive ? 'bg-slate-950 text-white' : 'bg-white/70 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <item.icon size={20} className={isActive ? 'text-white' : 'text-[#1d6fff]'} />
                        <div>
                          <p className="font-semibold">{item.label}</p>
                          <p className={`mt-1 text-xs ${isActive ? 'text-white/68' : 'text-slate-400'}`}>{item.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-[24px] bg-slate-950 p-5 text-white">
                  <p className="text-sm font-semibold">{primaryAction.label}</p>
                  <p className="mt-2 text-xs leading-6 text-white/68">{primaryAction.helper}</p>
                  <button
                    type="button"
                    onClick={() => handleNavigation(primaryAction.path)}
                    className="mt-4 rounded-[18px] bg-white px-4 py-3 text-sm font-semibold text-slate-950"
                  >
                    Open
                  </button>
                </div>

                <div className="mt-auto space-y-2 pt-6">
                  {secondaryActions.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleNavigation(item.path)}
                      className="flex w-full items-center gap-4 rounded-[18px] px-4 py-3 text-left text-slate-600 transition hover:bg-white/80 hover:text-slate-950"
                    >
                      <item.icon size={18} className="text-slate-400" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-4 rounded-[18px] bg-red-50 px-4 py-3 text-left text-red-600"
                  >
                    <LogOut size={18} />
                    <span className="text-sm font-semibold">Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
