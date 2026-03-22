import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Clock3,
  FileText,
  HelpCircle,
  Lock,
  Mail,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

const publicLinks = [
  { path: '/about', label: 'About' },
  { path: '/help', label: 'Help' },
  { path: '/contact', label: 'Contact' },
  { path: '/privacy', label: 'Privacy' },
  { path: '/terms', label: 'Terms' }
];

const quickFacts = [
  { icon: ShieldCheck, title: 'Safety Focused', description: 'Driver review, ride visibility, and parent-first communication.' },
  { icon: Clock3, title: 'Always Available', description: 'Policies, contact details, and support guidance are reachable without login.' },
  { icon: Sparkles, title: 'Clear Expectations', description: 'Product, legal, and support pages now live in the app as first-class routes.' }
];

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
    <h2 className="text-lg font-bold text-slate-950">{title}</h2>
    <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">{children}</div>
  </section>
);

const ContactCard: React.FC<{ icon: LucideIcon; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#3A77FF]">
      <Icon size={20} />
    </div>
    <h3 className="font-semibold text-slate-950">{title}</h3>
    <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
  </div>
);

const PublicPageShell: React.FC<{
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ icon: Icon, eyebrow, title, description, children }) => (
  <div className="min-h-screen bg-[linear-gradient(180deg,#e8f3ff_0%,#f8fbff_42%,#ffffff_100%)]">
    <div className="mx-auto max-w-6xl px-6 py-8 sm:py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to KidRide
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[320px,1fr]">
        <aside className="rounded-[32px] bg-slate-950 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-white/12 text-white">
            <Icon size={24} />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{description}</p>

          <div className="mt-8 space-y-3">
            {publicLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/88 transition hover:bg-white/10"
              >
                <span>{link.label}</span>
                <span className="text-white/45">/</span>
              </Link>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            {quickFacts.map(({ icon: FactIcon, title: factTitle, description: factDescription }) => (
              <div key={factTitle} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sky-200">
                  <FactIcon size={18} />
                </div>
                <p className="font-semibold text-white">{factTitle}</p>
                <p className="mt-2 text-xs leading-6 text-slate-300">{factDescription}</p>
              </div>
            ))}
          </div>
        </aside>

        <main className="space-y-6 rounded-[32px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-8">
          {children}
        </main>
      </div>
    </div>
  </div>
);

export const AboutPage = () => (
  <PublicPageShell
    icon={Sparkles}
    eyebrow="About KidRide"
    title="Built for families that need predictable rides."
    description="KidRide is designed around school runs, activity drop-offs, and the extra coordination that comes with transporting children safely."
  >
    <Section title="What KidRide does">
      <p>
        KidRide gives parents a dedicated place to manage child profiles, request rides, follow trip progress, and keep driver verification visible throughout the experience.
      </p>
      <p>
        The product also supports drivers through onboarding, application review, and a driver-side dashboard for accepting and progressing rides.
      </p>
    </Section>

    <Section title="Why the product exists">
      <p>
        Most ride tools are optimized for adults moving themselves. KidRide instead assumes a parent is coordinating transportation for someone else and needs more visibility, more trust signals, and more clarity before a ride starts.
      </p>
      <p>
        That changes the interface, the communication patterns, and the policy surface. The static pages in this app are part of making those expectations explicit.
      </p>
    </Section>

    <Section title="What parents and drivers can expect">
      <p>Parents can create accounts, manage children, request rides, and see active ride status from a single dashboard.</p>
      <p>Drivers can create accounts, complete verification, and manage work from a separate driver flow tailored to availability and trip progression.</p>
    </Section>
  </PublicPageShell>
);

export const HelpPage = () => (
  <PublicPageShell
    icon={HelpCircle}
    eyebrow="Help Center"
    title="Answers for common account, ride, and safety questions."
    description="This page is the public support entry point for people who need guidance before or after signing in."
  >
    <Section title="Account help">
      <p>Use the home screen to create a parent or driver account with your own email and password.</p>
      <p>If you lose access, try signing in again with the same email address in lowercase and confirm the backend API is reachable from your frontend environment.</p>
    </Section>

    <Section title="Driver application help">
      <p>New drivers start by creating a driver account, then continue directly into the verification flow to submit vehicle details and supporting documents.</p>
      <p>Signed-in parents can also use the driver application flow if they are applying to drive under their existing account.</p>
    </Section>

    <Section title="Ride and safety help">
      <p>Parents can add children, request rides, and follow ride status from the parent dashboard once logged in.</p>
      <p>Drivers can accept new requests from the driver dashboard and progress rides through the status flow shown in the app.</p>
      <p>For in-app assistance after login, the Safety screen remains available from the authenticated navigation.</p>
    </Section>
  </PublicPageShell>
);

export const ContactPage = () => (
  <PublicPageShell
    icon={Mail}
    eyebrow="Contact"
    title="Reach the KidRide team."
    description="Public support channels are still being finalized, so this page reflects only the contact paths that are actually available in this build."
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <ContactCard icon={Mail} title="Account Support">
        <p>Direct support email is not published yet.</p>
        <p className="mt-1">Use the Help page and in-app guidance after sign-in for current support instructions.</p>
      </ContactCard>
      <ContactCard icon={PhoneCall} title="Urgent Help">
        <p>Emergency dispatch is not handled inside this app build.</p>
        <p className="mt-1">Call local emergency services directly if you need immediate help.</p>
      </ContactCard>
      <ContactCard icon={MapPin} title="Operations">
        <p>Mailing details are not published yet.</p>
        <p className="mt-1">Check back once operations contact information is configured.</p>
      </ContactCard>
      <ContactCard icon={Clock3} title="Response Timing">
        <p>Response targets have not been announced for this build.</p>
        <p className="mt-1">Support availability may vary while channels are still being set up.</p>
      </ContactCard>
    </div>

    <Section title="How to get help right now">
      <p>If you cannot access your account, start from the Help page and confirm the frontend can reach the configured backend API.</p>
      <p>For urgent safety concerns, do not wait on in-app tools. Use local emergency services and your own emergency contacts directly.</p>
      <p>For deployment troubleshooting, include your frontend origin and API base URL so environment issues can be diagnosed faster.</p>
    </Section>
  </PublicPageShell>
);

export const PrivacyPage = () => (
  <PublicPageShell
    icon={Lock}
    eyebrow="Privacy Policy"
    title="How KidRide handles account and ride information."
    description="This privacy page explains the kinds of information the app stores, why it is used, and what expectations users should have around session and ride data."
  >
    <Section title="Information we collect">
      <p>KidRide stores account details such as name, email address, role, and authentication tokens needed to keep a user signed in.</p>
      <p>The app may also store child profile details, driver application data, ride information, and profile metadata that supports the parent and driver experiences.</p>
    </Section>

    <Section title="How information is used">
      <p>Account data is used to authenticate users, restore sessions, and determine whether the signed-in experience should follow the parent or driver path.</p>
      <p>Ride and profile data is used to support booking, assignment, status updates, and safety-related visibility within the product.</p>
    </Section>

    <Section title="Storage and access">
      <p>Authentication tokens and cached profile data are stored in browser local storage by the frontend so sessions can be restored across refreshes.</p>
      <p>Protected backend routes require a bearer token. If the backend rejects a session, the frontend clears the cached token and profile data.</p>
    </Section>

    <Section title="Your choices">
      <p>You can sign out at any time from the app menu. If you need assistance removing account data, contact support using the channels listed on the contact page.</p>
    </Section>
  </PublicPageShell>
);

export const TermsPage = () => (
  <PublicPageShell
    icon={FileText}
    eyebrow="Terms of Service"
    title="The basic rules for using KidRide."
    description="These terms set expectations for account creation, acceptable use, and the relationship between frontend behavior and backend services."
  >
    <Section title="Using the service">
      <p>Users are responsible for providing accurate account details during signup and for keeping login credentials secure.</p>
      <p>Driver applicants are expected to submit complete and truthful verification information when using the application flow.</p>
    </Section>

    <Section title="Platform behavior">
      <p>KidRide depends on backend services for authentication, ride operations, and profile persistence. Some features may be unavailable if those services are unreachable or misconfigured.</p>
      <p>The app may restrict access to authenticated routes when no valid session is present, and it may clear stale session data when the backend rejects a token.</p>
    </Section>

    <Section title="Acceptable use">
      <p>Do not misuse the platform, attempt to access data you are not authorized to view, or submit false driver information through the verification flow.</p>
      <p>Use of the service is subject to review, suspension, or removal if activity creates safety, legal, or operational risk.</p>
    </Section>

    <Section title="Contact">
      <p>Questions about these terms can be directed to the support channels on the contact page.</p>
    </Section>
  </PublicPageShell>
);
