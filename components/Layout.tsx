import React, { useEffect, useState } from 'react';
import { BrandLockup } from './brand/BrandLockup';
import { BrandMark } from './brand/BrandMark';
import {
  Bell,
  Briefcase,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  Car,
  DollarSign,
  HelpCircle,
  Home,
  LogOut,
  Map,
  MessageCircle,
  Navigation,
  User,
  Users,
  X
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { UserRole } from '../types';

// App shell: a collapsible icon rail on large screens (full labels or icons
// only, remembered per browser), a slim top bar and a bottom tab bar on
// phones. Plain Cloud background, hairlines, no decoration; the pages carry
// the content.

interface LayoutProps {
  children: React.ReactNode;
}

type NavItem = { icon: typeof Home; label: string; path: string };

const pageTitles: Record<string, string> = {
  '/dashboard': 'Home',
  '/add-child': 'Add a child',
  '/book': 'Book a ride',
  '/carpools': 'Carpools',
  '/rides': 'Rides',
  '/tracking/:id': 'Live tracking',
  '/safety': 'Safety',
  '/profile': 'Profile',
  '/notifications': 'Notifications',
  '/profile/notifications': 'Notification settings',
  '/profile/payments': 'Payments',
  '/driver-dashboard': 'Jobs',
  '/driver-map': 'Map',
  '/admin': 'Applications',
  '/admin/drivers': 'Drivers',
  '/admin/parents': 'Parents',
  '/admin/live-map': 'Live map',
  '/admin/rides': 'Rides',
  '/earnings': 'Earnings'
};

const publicPagePaths = new Set(['/', '/login', '/about', '/safety-info', '/for-drivers', '/faq', '/help', '/contact', '/privacy', '/terms', '/drive', '/driver-signup']);

const parentNavItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Car, label: 'Rides', path: '/rides' },
  { icon: MessageCircle, label: 'Safety', path: '/safety' },
  { icon: User, label: 'Profile', path: '/profile' }
];

const driverNavItems: NavItem[] = [
  { icon: Briefcase, label: 'Jobs', path: '/driver-dashboard' },
  { icon: Map, label: 'Map', path: '/driver-map' },
  { icon: DollarSign, label: 'Earnings', path: '/earnings' },
  { icon: User, label: 'Profile', path: '/profile' }
];

const adminNavItems: NavItem[] = [
  { icon: ClipboardCheck, label: 'Applications', path: '/admin' },
  { icon: Car, label: 'Drivers', path: '/admin/drivers' },
  { icon: Users, label: 'Parents', path: '/admin/parents' },
  { icon: Map, label: 'Rides', path: '/admin/rides' },
  { icon: Navigation, label: 'Live map', path: '/admin/live-map' },
  { icon: User, label: 'Profile', path: '/profile' }
];

const resolveRouteKey = (pathname: string) => (pathname.startsWith('/tracking/') ? '/tracking/:id' : pathname.startsWith('/edit-child/') ? '/add-child' : pathname);

const userInitials = (name: string | undefined) =>
  (name || '').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'KR';

const RAIL_KEY = 'kidride.rail';
const readRailPreference = () => {
  try {
    const saved = window.localStorage.getItem(RAIL_KEY);
    if (saved === 'open' || saved === 'closed') return saved === 'open';
  } catch { /* not remembered */ }
  return window.innerWidth >= 1280;
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(readRailPreference);
  // Hovering the collapsed rail opens it as a flyout until the pointer leaves.
  const [railHover, setRailHover] = useState(false);
  const expanded = railOpen || railHover;

  useEffect(() => {
    try { window.localStorage.setItem(RAIL_KEY, railOpen ? 'open' : 'closed'); } catch { /* not remembered */ }
  }, [railOpen]);

  // Must come after every hook so public and app pages call the same hooks.
  if (publicPagePaths.has(location.pathname)) {
    return <div className="min-h-screen text-ink">{children}</div>;
  }

  const isAdmin = user?.role === UserRole.ADMIN;
  const isDriver = user?.role === UserRole.DRIVER;
  const navItems = isAdmin ? adminNavItems : isDriver ? driverNavItems : parentNavItems;
  const homePath = isAdmin ? '/admin' : isDriver ? '/driver-dashboard' : '/dashboard';
  const title = pageTitles[resolveRouteKey(location.pathname)] || navItems.find((item) => item.path === location.pathname)?.label || 'KidRide';
  const roleLabel = isAdmin ? 'Admin' : isDriver ? (user?.driverApplicationStatus === 'approved' ? 'Verified driver' : 'Driver') : 'Parent';

  const go = (path: string) => { navigate(path); setIsMenuOpen(false); };
  const handleLogout = () => { logout(); navigate('/'); setIsMenuOpen(false); };

  const Avatar: React.FC<{ size?: number }> = ({ size = 36 }) => (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-sm font-semibold text-brand-deep" style={{ width: size, height: size }}>
      {user?.photoUrl ? <img src={user.photoUrl} alt="" className="h-full w-full object-cover" /> : userInitials(user?.name)}
    </span>
  );

  const badge = unreadCount > 0 && (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white" aria-label={`${unreadCount} unread`}>{unreadCount > 99 ? '99+' : unreadCount}</span>
  );

  const railItem = (item: NavItem) => {
    const active = location.pathname === item.path;
    return (
      <button
        key={item.path}
        type="button"
        onClick={() => go(item.path)}
        title={expanded ? undefined : item.label}
        aria-current={active ? 'page' : undefined}
        className={`flex h-11 w-full items-center rounded-control text-left text-[15px] transition-colors ${expanded ? 'gap-3 px-3' : 'justify-center'} ${
          active ? 'bg-brand/15 font-semibold text-ink' : 'font-medium text-muted hover:bg-surface-2 hover:text-ink'
        }`}
      >
        <item.icon size={22} strokeWidth={active ? 2.25 : 1.75} className={active ? 'text-brand-deep' : ''} />
        {expanded && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="flex min-h-screen">
        {/* Icon rail / sidebar */}
        <aside className={`sticky top-0 hidden h-screen shrink-0 lg:block ${railOpen ? 'w-60' : 'w-[72px]'}`} onMouseEnter={() => setRailHover(true)} onMouseLeave={() => setRailHover(false)}>
         <div className={`absolute inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-white transition-[width] duration-200 ${expanded ? 'w-60' : 'w-[72px]'} ${expanded && !railOpen ? 'shadow-float' : ''}`}>
          <div className={`flex h-16 items-center ${expanded ? 'justify-between pl-4 pr-2' : 'justify-center'}`}>
            <button type="button" onClick={() => go(homePath)} className="flex items-center" aria-label="KidRide home">
              {expanded ? <BrandLockup size={52} /> : <BrandMark size={40} title="KidRide" />}
            </button>
            {expanded && (
              <button
                type="button"
                onClick={() => setRailOpen(!railOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
                aria-label={railOpen ? 'Collapse menu' : 'Keep menu open'}
                title={railOpen ? 'Collapse' : 'Keep open'}
              >
                {railOpen ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
              </button>
            )}
          </div>

          <nav className="mt-4 flex flex-col gap-1 px-3">
            {navItems.map(railItem)}
            <button
              type="button"
              onClick={() => go('/notifications')}
              title={expanded ? undefined : 'Inbox'}
              aria-current={location.pathname === '/notifications' ? 'page' : undefined}
              className={`flex h-11 w-full items-center rounded-control text-left text-[15px] transition-colors ${expanded ? 'gap-3 px-3' : 'justify-center'} ${
                location.pathname === '/notifications' ? 'bg-brand/15 font-semibold text-ink' : 'font-medium text-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <span className="relative"><Bell size={22} strokeWidth={location.pathname === '/notifications' ? 2.25 : 1.75} className={location.pathname === '/notifications' ? 'text-brand-deep' : ''} />{badge}</span>
              {expanded && <span className="truncate">Inbox</span>}
            </button>
          </nav>

          <div className={`mt-auto flex flex-col gap-1 px-3 pb-4 ${expanded ? '' : 'items-center'}`}>
            <button type="button" onClick={() => go('/help')} title={expanded ? undefined : 'Help'} className={`flex h-11 w-full items-center rounded-control text-[15px] font-medium text-muted hover:bg-surface-2 hover:text-ink ${expanded ? 'gap-3 px-3' : 'justify-center'}`}>
              <HelpCircle size={22} strokeWidth={1.75} />
              {expanded && <span>Help</span>}
            </button>
            <button type="button" onClick={handleLogout} title={expanded ? undefined : 'Log out'} className={`flex h-11 w-full items-center rounded-control text-[15px] font-medium text-muted hover:bg-surface-2 hover:text-danger ${expanded ? 'gap-3 px-3' : 'justify-center'}`}>
              <LogOut size={22} strokeWidth={1.75} />
              {expanded && <span>Log out</span>}
            </button>
            <button type="button" onClick={() => go('/profile')} title={expanded ? undefined : user?.name} className={`mt-2 flex w-full items-center rounded-control border-t border-line pt-3 text-left ${expanded ? 'gap-3 px-2' : 'justify-center'}`}>
              <Avatar />
              {expanded && (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{user?.name || 'KidRide'}</span>
                  <span className="block text-xs text-muted">{roleLabel}</span>
                </span>
              )}
            </button>
          </div>
         </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone top bar */}
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
            <button type="button" onClick={() => go(homePath)} aria-label="KidRide home"><BrandMark size={40} title="KidRide" /></button>
            <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => go('/notifications')} className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink" aria-label="Inbox"><Bell size={22} strokeWidth={1.75} />{badge}</button>
              <button type="button" onClick={() => setIsMenuOpen(true)} aria-label="Account menu"><Avatar size={34} /></button>
            </div>
          </header>

          <main className="flex-1 pb-24 lg:pb-10">
            <div className="mx-auto w-full max-w-[1180px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
              {/* Home screens open with their own greeting, so no page title there. */}
              {location.pathname !== homePath && <h1 className="mb-6 hidden text-headline font-extrabold tracking-tight lg:block">{title}</h1>}
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Phone bottom tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button key={item.path} type="button" onClick={() => navigate(item.path)} aria-current={active ? 'page' : undefined} className={`flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] ${active ? 'font-semibold text-brand-deep' : 'font-medium text-muted'}`}>
              <item.icon size={22} strokeWidth={active ? 2.25 : 1.75} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Phone account sheet */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-sheet bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-float">
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
            <div className="flex items-center gap-3">
              <Avatar size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{user?.name || 'KidRide'}</p>
                <p className="text-sm text-muted">{roleLabel}</p>
              </div>
              <button type="button" onClick={() => setIsMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="Close"><X size={20} /></button>
            </div>
            <div className="mt-4 divide-y divide-line border-y border-line">
              <button type="button" onClick={() => go('/profile')} className="flex h-12 w-full items-center gap-3 text-[15px] font-medium"><User size={20} className="text-muted" />Profile</button>
              <button type="button" onClick={() => go('/help')} className="flex h-12 w-full items-center gap-3 text-[15px] font-medium"><HelpCircle size={20} className="text-muted" />Help</button>
              <button type="button" onClick={handleLogout} className="flex h-12 w-full items-center gap-3 text-[15px] font-medium text-danger"><LogOut size={20} />Log out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
