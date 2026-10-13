import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Baby,
  Car,
  ClipboardCheck,
  FileText,
  HelpCircle,
  KeyRound,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users
} from 'lucide-react';
import { CtaBand, FeatureCard, PageHero, PublicSiteLayout, SectionBlock } from '../components/PublicSite';

const safetyFeatures = [
  {
    icon: KeyRound,
    title: 'Trip codes',
    body: 'Each ride has a trip code that the driver and your child can confirm at pickup, so everyone knows they have the right ride.'
  },
  {
    icon: MessageCircle,
    title: 'Safe words',
    body: 'Rides carry a safe word your child can ask for before getting in the car. If the driver cannot give it, the child should not get in.'
  },
  {
    icon: UserCheck,
    title: 'Driver verification',
    body: 'Drivers submit an application with license, insurance, registration and identity photos. Accounts are only activated after the application is reviewed and approved.'
  },
  {
    icon: Navigation,
    title: 'Live GPS tracking',
    body: 'Once a ride is underway, parents can follow its progress on a live map and see status updates from pickup to drop-off.'
  }
];

const serviceTypes = [
  { icon: MapPin, title: 'Pickup only', body: 'A driver collects your child from a location such as school or practice.' },
  { icon: Car, title: 'Drop-off only', body: 'A driver takes your child to where they need to be.' },
  { icon: Repeat, title: 'Pickup and drop-off', body: 'A single booking that covers both legs of the trip.' },
  { icon: Baby, title: 'Stay with child and drop-off', body: 'The driver waits with your child at the destination before the drop-off leg.' }
];

const parentSteps = [
  { title: 'Create your account', body: 'Sign up as a parent and add a profile for each child you will book rides for.' },
  { title: 'Book a ride', body: 'Choose the service type, pickup and drop-off locations, and time.' },
  { title: 'Share the trip code and safe word', body: 'Go over the trip code and safe word with your child before pickup.' },
  { title: 'Follow along', body: 'Track the ride live and see each status change until your child arrives.' }
];

const driverSteps = [
  { title: 'Create a driver account', body: 'Sign up and choose the driver role.' },
  { title: 'Submit your application', body: 'Upload your license, insurance, vehicle registration and identity photos.' },
  { title: 'Wait for review', body: 'Your application is reviewed by the KidRide team before your account is activated.' },
  { title: 'Accept rides', body: 'Once approved, see open jobs and move rides through each step in the driver console.' }
];

const StepList: React.FC<{ steps: { title: string; body: string }[] }> = ({ steps }) => (
  <ol className="space-y-4">
    {steps.map((step, index) => (
      <li key={step.title} className="flex gap-4">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d6fff] text-sm font-bold text-white">{index + 1}</span>
        <div>
          <p className="font-semibold text-slate-950">{step.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
        </div>
      </li>
    ))}
  </ol>
);

const Prose: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm sm:p-8">{children}</div>
);

export const LandingPage = () => (
  <PublicSiteLayout>
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr,0.9fr]">
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 shadow-sm">
          <Sparkles size={14} /> Rides for kids, built for parents
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
          Get your kids where they need to go, with you in the loop.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
          KidRide helps parents book rides for their children with reviewed drivers, trip codes, safe words and live tracking from pickup to drop-off.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1d6fff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(29,111,255,0.25)] transition hover:bg-[#1558d6]">
            Sign up as a parent <ArrowRight size={16} />
          </Link>
          <Link to="/for-drivers" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300">
            Drive with KidRide
          </Link>
        </div>
      </div>
      <div className="rounded-[32px] bg-slate-950 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Every ride includes</p>
        <ul className="mt-5 space-y-4">
          {safetyFeatures.map(({ icon: Icon, title }) => (
            <li key={title} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sky-200"><Icon size={18} /></span>
              <span className="font-semibold">{title}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>

    <SectionBlock title="How it works" intro="Separate, focused flows for the parents booking rides and the drivers providing them.">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-center gap-3"><Users className="text-[#1d6fff]" size={22} /><h3 className="text-lg font-bold text-slate-950">For parents</h3></div>
          <StepList steps={parentSteps} />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-5 flex items-center gap-3"><Car className="text-[#1d6fff]" size={22} /><h3 className="text-lg font-bold text-slate-950">For drivers</h3></div>
          <StepList steps={driverSteps} />
        </div>
      </div>
    </SectionBlock>

    <SectionBlock title="Safety built into every trip" intro="The checks parents care about are part of the ride itself, not an afterthought.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {safetyFeatures.map((feature) => (
          <FeatureCard key={feature.title} icon={feature.icon} title={feature.title}>{feature.body}</FeatureCard>
        ))}
      </div>
      <Link to="/safety-info" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#1d6fff] hover:underline">
        Read more about safety <ArrowRight size={16} />
      </Link>
    </SectionBlock>

    <SectionBlock title="Service types" intro="Pick the kind of trip that matches your day.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {serviceTypes.map((service) => (
          <FeatureCard key={service.title} icon={service.icon} title={service.title}>{service.body}</FeatureCard>
        ))}
      </div>
    </SectionBlock>

    <CtaBand
      title="Ready to get started?"
      description="Create a parent account to add your children and book your first ride, or apply to drive with KidRide."
      primary={{ to: '/login', label: 'Create an account' }}
      secondary={{ to: '/for-drivers', label: 'Learn about driving' }}
    />
  </PublicSiteLayout>
);

export const MarketingAboutPage = () => (
  <PublicSiteLayout>
    <PageHero
      icon={Sparkles}
      eyebrow="About KidRide"
      title="Built for families that need predictable rides."
      description="KidRide is designed around school runs, activity drop-offs, and the extra coordination that comes with transporting children."
    />
    <SectionBlock>
      <div className="grid gap-6 md:grid-cols-2">
        <Prose>
          <h2 className="text-lg font-bold text-slate-950">What KidRide does</h2>
          <p>KidRide gives parents one place to manage child profiles, request rides, follow trip progress and keep driver details visible throughout the ride.</p>
          <p>Drivers get their own flow: an application with document review, and a driver console for accepting and progressing rides once approved.</p>
        </Prose>
        <Prose>
          <h2 className="text-lg font-bold text-slate-950">Why it exists</h2>
          <p>Most ride apps are built for adults moving themselves. KidRide assumes a parent is coordinating transport for someone else, and needs more visibility and more trust signals before a ride starts.</p>
          <p>That shapes everything from how drivers are onboarded to how a child confirms they are getting into the right car.</p>
        </Prose>
      </div>
    </SectionBlock>
    <CtaBand title="See how KidRide works" description="Start with a parent account, or learn what it takes to drive." primary={{ to: '/login', label: 'Sign up' }} secondary={{ to: '/safety-info', label: 'Our approach to safety' }} />
  </PublicSiteLayout>
);

export const SafetyInfoPage = () => (
  <PublicSiteLayout>
    <PageHero
      icon={ShieldCheck}
      eyebrow="Safety"
      title="Safety checks that are part of every ride."
      description="Here is what KidRide does to help parents feel confident handing off a trip, and what we recommend families do too."
    />
    <SectionBlock>
      <div className="grid gap-4 sm:grid-cols-2">
        {safetyFeatures.map((feature) => (
          <FeatureCard key={feature.title} icon={feature.icon} title={feature.title}>{feature.body}</FeatureCard>
        ))}
      </div>
    </SectionBlock>
    <SectionBlock title="Driver review">
      <Prose>
        <p>Every driver account starts as an application. Drivers upload their driver's license, proof of insurance, vehicle registration, and identity photos taken from several angles.</p>
        <p>The KidRide team reviews each application before it is approved. Drivers cannot see or accept rides until their application has been approved, and an application can be rejected at review.</p>
      </Prose>
    </SectionBlock>
    <SectionBlock title="Tips for families">
      <Prose>
        <ul className="list-disc space-y-2 pl-5">
          <li>Go over the trip code and safe word with your child before every ride.</li>
          <li>Teach your child not to get in the car if the driver cannot confirm the safe word.</li>
          <li>Check the driver and vehicle details shown in the app before pickup.</li>
          <li>Keep the ride open in the app so you can follow live status updates.</li>
          <li>In an emergency, contact local emergency services first.</li>
        </ul>
      </Prose>
    </SectionBlock>
    <CtaBand title="Questions about safety?" description="Read the FAQ or get in touch with the KidRide team." primary={{ to: '/faq', label: 'Read the FAQ' }} secondary={{ to: '/contact', label: 'Contact us' }} />
  </PublicSiteLayout>
);

export const ForDriversPage = () => (
  <PublicSiteLayout>
    <PageHero
      icon={Car}
      eyebrow="For drivers"
      title="Drive with KidRide."
      description="Help families get their kids to school, practice and activities. Every driver goes through an application and review before taking rides."
    />
    <SectionBlock title="How to become a driver">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <StepList steps={driverSteps} />
      </div>
    </SectionBlock>
    <SectionBlock title="What you will need">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard icon={BadgeCheck} title="Driver's license">A valid license, uploaded as an image or PDF.</FeatureCard>
        <FeatureCard icon={FileText} title="Insurance">Proof of current vehicle insurance.</FeatureCard>
        <FeatureCard icon={ClipboardCheck} title="Vehicle registration">Registration for the vehicle you plan to drive.</FeatureCard>
        <FeatureCard icon={UserCheck} title="Identity photos">Photos of you from the front, left and right, taken in the app.</FeatureCard>
      </div>
    </SectionBlock>
    <SectionBlock title="On every ride">
      <Prose>
        <p>Drivers confirm the trip code with the child at pickup and should be ready to give the ride's safe word when asked. The driver console walks you through each step: arriving at pickup, picking up the child, and completing the ride.</p>
      </Prose>
    </SectionBlock>
    <CtaBand title="Ready to apply?" description="Create a driver account, then complete your application." primary={{ to: '/login', label: 'Create a driver account' }} secondary={{ to: '/drive', label: 'Driver overview' }} />
  </PublicSiteLayout>
);

const faqs = [
  { q: 'Who can book a ride?', a: 'Parents and guardians with a KidRide parent account. You add a profile for each child before booking.' },
  { q: 'What service types are available?', a: 'Pickup only, drop-off only, pickup and drop-off, and stay with child and drop-off.' },
  { q: 'What is a trip code?', a: 'A code attached to each ride that the driver and your child can confirm at pickup to make sure it is the right ride.' },
  { q: 'What is a safe word?', a: 'A word attached to the ride that your child can ask the driver for. If the driver cannot give it, your child should not get in the car.' },
  { q: 'Can I see where the ride is?', a: 'Yes. While a ride is in progress you can follow it on a live map in the app, along with status updates.' },
  { q: 'How are drivers reviewed?', a: 'Drivers submit an application with their license, insurance, registration and identity photos. Their account is only activated after the KidRide team reviews and approves the application.' },
  { q: 'How do I become a driver?', a: 'Create an account with the driver role and complete the driver application. You will be able to accept rides once your application is approved.' },
  { q: 'Can I cancel a ride?', a: 'Rides can be cancelled from the app before they are completed. See the Terms of Service for details.' },
  { q: 'How is my data handled?', a: 'See our Privacy Policy for what we collect and how it is used.' }
];

export const FaqPage = () => (
  <PublicSiteLayout>
    <PageHero icon={HelpCircle} eyebrow="FAQ" title="Frequently asked questions" description="Quick answers for parents and drivers. Can't find what you need? Get in touch." />
    <SectionBlock>
      <div className="space-y-3">
        {faqs.map((item) => (
          <details key={item.q} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-950">
              {item.q}
              <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-600">
        See also the <Link to="/privacy" className="font-semibold text-[#1d6fff] hover:underline">Privacy Policy</Link> and{' '}
        <Link to="/terms" className="font-semibold text-[#1d6fff] hover:underline">Terms of Service</Link>.
      </p>
    </SectionBlock>
    <CtaBand title="Still have questions?" description="See how to reach the KidRide team." primary={{ to: '/contact', label: 'Contact us' }} />
  </PublicSiteLayout>
);

export const MarketingContactPage = () => (
  <PublicSiteLayout>
    <PageHero icon={Mail} eyebrow="Contact" title="Get in touch" description="Questions about rides, driver applications or your account? Here is how to reach us." />
    <SectionBlock>
      <div className="grid gap-4 md:grid-cols-3">
        <FeatureCard icon={Mail} title="Account support">
          A public support email has not been published yet. After signing in, use the in-app Help and safety tools for current support instructions.
        </FeatureCard>
        <FeatureCard icon={Car} title="Driver applications">
          Your application status and decision are shown in the app after you sign in, on the driver application screen.
        </FeatureCard>
        <FeatureCard icon={ShieldCheck} title="Urgent safety concerns">
          If a child is in danger, contact local emergency services immediately. Emergency dispatch is not handled through KidRide.
        </FeatureCard>
      </div>
      <p className="mt-6 text-sm text-slate-600">
        Signed-in users can also use the in-app help and safety tools. Browse the <Link to="/faq" className="font-semibold text-[#1d6fff] hover:underline">FAQ</Link> or the{' '}
        <Link to="/help" className="font-semibold text-[#1d6fff] hover:underline">Help</Link> page for common questions.
      </p>
    </SectionBlock>
  </PublicSiteLayout>
);
