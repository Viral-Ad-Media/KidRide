import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Menu, X } from 'lucide-react';
import { BrandLockup } from './brand/BrandLockup';

const navLinks = [
  { path: '/about', label: 'About' },
  { path: '/safety-info', label: 'Safety' },
  { path: '/for-drivers', label: 'For Drivers' },
  { path: '/faq', label: 'FAQ' },
  { path: '/contact', label: 'Contact' }
];

const footerGroups = [
  {
    title: 'KidRide',
    links: [
      { path: '/', label: 'Home' },
      { path: '/about', label: 'About' },
      { path: '/safety-info', label: 'Safety' },
      { path: '/contact', label: 'Contact' }
    ]
  },
  {
    title: 'Get started',
    links: [
      { path: '/login', label: 'Log in or sign up' },
      { path: '/for-drivers', label: 'Drive with KidRide' },
      { path: '/driver-signup', label: 'Driver application' },
      { path: '/faq', label: 'FAQ' }
    ]
  },
  {
    title: 'Legal & support',
    links: [
      { path: '/help', label: 'Help' },
      { path: '/privacy', label: 'Privacy Policy' },
      { path: '/terms', label: 'Terms of Service' }
    ]
  }
];

export const PublicHeader: React.FC = () => {
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-white hover:text-slate-950'}`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <BrandLockup size={56} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {navLinks.map((link) => (
            <NavLink key={link.path} to={link.path} className={linkClass}>{link.label}</NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950">Log in</Link>
          <Link to="/login" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-ink shadow-float transition hover:brightness-95">Sign up</Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 lg:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <NavLink key={link.path} to={link.path} className={linkClass} onClick={() => setOpen(false)}>{link.label}</NavLink>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/login" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700">Log in</Link>
            <Link to="/login" onClick={() => setOpen(false)} className="rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-ink">Sign up</Link>
          </div>
        </nav>
      )}
    </header>
  );
};

export const PublicFooter: React.FC = () => (
  <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr,1fr,1fr,1fr]">
      <div>
        <div className="flex items-center gap-3">
          <BrandLockup size={56} inverse />
        </div>
        <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
          Ride coordination built around parents, children, and reviewed drivers.
        </p>
      </div>
      {footerGroups.map((group) => (
        <div key={group.title}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">{group.title}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {group.links.map((link) => (
              <li key={link.path + link.label}>
                <Link to={link.path} className="transition hover:text-white">{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500">
      &copy; {new Date().getFullYear()} KidRide. All rights reserved.
    </div>
  </footer>
);

export const PublicSiteLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen flex-col bg-surface text-slate-900">
    <PublicHeader />
    <main className="flex-1">{children}</main>
    <PublicFooter />
  </div>
);

export const PageHero: React.FC<{ eyebrow: string; title: string; description: string; icon?: LucideIcon }> = ({ eyebrow, title, description, icon: Icon }) => (
  <section className="mx-auto max-w-6xl px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
    {Icon && (
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand-deep"><Icon size={22} /></div>
    )}
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-deep">{eyebrow}</p>
    <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-slate-950 sm:text-5xl">{title}</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
  </section>
);

export const FeatureCard: React.FC<{ icon: LucideIcon; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand-deep"><Icon size={20} /></div>
    <h3 className="font-semibold text-slate-950">{title}</h3>
    <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
  </div>
);

export const SectionBlock: React.FC<{ title?: string; intro?: string; children: React.ReactNode; className?: string }> = ({ title, intro, children, className = '' }) => (
  <section className={`mx-auto max-w-6xl px-4 py-8 sm:px-6 ${className}`}>
    {title && <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">{title}</h2>}
    {intro && <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{intro}</p>}
    <div className={title || intro ? 'mt-6' : ''}>{children}</div>
  </section>
);

export const CtaBand: React.FC<{ title: string; description: string; primary: { to: string; label: string }; secondary?: { to: string; label: string } }> = ({ title, description, primary, secondary }) => (
  <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
    <div className="rounded-[32px] bg-slate-950 p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-10">
      <h2 className="text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to={primary.to} className="rounded-full bg-brand px-6 py-3 text-center text-sm font-semibold text-ink transition hover:brightness-95">{primary.label}</Link>
        {secondary && (
          <Link to={secondary.to} className="rounded-full border border-white/20 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10">{secondary.label}</Link>
        )}
      </div>
    </div>
  </section>
);
