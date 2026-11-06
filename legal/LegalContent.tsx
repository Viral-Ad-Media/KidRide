import React from 'react';
import { Link } from 'react-router-dom';
import { LEGAL } from './legalConfig';

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-bold text-ink first:mt-0">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="mt-3 text-sm leading-7 text-slate-600">{children}</p>;
const UL = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
    {items.map((item, index) => <li key={index}>{item}</li>)}
  </ul>
);

export const DraftNotice = () => (LEGAL.isDraft ? (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    Draft for legal review. This document has not yet been reviewed by a lawyer and may change before launch.
  </div>
) : null);

const Meta = () => (
  <p className="text-xs text-slate-500">
    Effective {LEGAL.effectiveDate} · Version {LEGAL.version} · {LEGAL.companyName}, {LEGAL.companyAddress}
  </p>
);

export const TermsContent = () => (
  <article>
    <DraftNotice />
    <div className="mt-4"><Meta /></div>

    <H>1. Who we are and what these terms cover</H>
    <P>
      KidRide is operated by {LEGAL.companyName} ("KidRide", "we", "us"). These Terms of Service govern your use of the KidRide
      website and apps (the "Service"). By creating an account you agree to these terms and to our{' '}
      <Link to="/privacy" className="font-semibold text-brand-deep hover:underline">Privacy Policy</Link>. If you do not agree, do not use the Service.
    </P>
    <P>
      KidRide is a technology platform that connects parents and guardians with independent, vetted drivers who transport children.
      [CONFIRM WITH LAWYER: whether KidRide acts as a transport operator or a booking platform in your launch market, and any
      licence it must hold, e.g. a private hire operator licence in the UK or TNC permit in the US.]
    </P>

    <H>2. Accounts and eligibility</H>
    <UL items={[
      'You must be at least 18 years old to create an account. Children never hold KidRide accounts; a parent or legal guardian books and manages rides for them.',
      'Parents must be the child\'s parent or legal guardian, or have that person\'s permission to arrange transport for the child.',
      'Keep your login details secure. You are responsible for activity on your account. Tell us straight away if you think your account has been misused.',
      'Information you give us, including about your children and, for drivers, about your licence, insurance and vehicle, must be accurate and kept up to date.'
    ]} />

    <H>3. Parents and guardians</H>
    <UL items={[
      'You are responsible for the accuracy of pickup and drop-off details, the child\'s details and any notes (for example allergies, medical needs, booster or car seat needs).',
      'Someone responsible must be available at pickup and drop-off as arranged. Share the trip code only with the child and people you trust; the driver must give it before the child gets in.',
      'Children must be of an age and maturity to ride without a parent present, as allowed by local law. [CONFIRM MINIMUM AGE AND CAR SEAT RULES FOR LAUNCH MARKET.]',
      'Fares are shown before you book. A cancellation fee may apply if you cancel after a driver is on the way, and a no-show fee may apply if the child is not available after the driver has waited the stated time.'
    ]} />

    <H>4. Drivers</H>
    <UL items={[
      'Drivers must pass KidRide\'s verification before driving, which may include identity, licence, insurance, vehicle and background checks, and must keep these valid.',
      'Drivers must follow traffic law, use appropriate child restraints, never leave a child unattended, never let anyone else ride with a child unless the booking allows it, and only release a child to the agreed person or place.',
      'Drivers must keep location sharing on during a ride so parents and KidRide can follow the trip.',
      'Drivers are independent [CONFIRM: contractors / employees] and are responsible for their own taxes, insurance and licences unless the law where they drive says otherwise.',
      'We may suspend or remove a driver at any time for safety reasons, complaints, failed or expired checks, or breach of these terms.'
    ]} />

    <H>5. Safety features</H>
    <P>
      KidRide provides live tracking, trip codes, SOS alerts, trusted contacts and route alerts to help keep rides safe. These features
      support, but do not replace, your own judgement. In an emergency always call your local emergency number first (911 in the US, 999 in the UK).
      SOS alerts and live links depend on mobile signal and device settings and may be delayed or unavailable.
    </P>

    <H>6. Payments</H>
    <P>
      Prices, fees and the driver's share are shown in the app. Card payments are handled by our payment provider and KidRide does not store
      full card numbers. [ADD REFUND POLICY AND PAYMENT PROVIDER TERMS WHEN PAYMENTS LAUNCH.]
    </P>

    <H>7. Acceptable use</H>
    <UL items={[
      'Do not use the Service for anything unlawful, to harass or endanger anyone, or to contact a child outside a booked ride.',
      'Do not access data you are not authorised to see, interfere with the Service, or give false information.',
      'We may suspend or close accounts that create safety, legal or operational risk.'
    ]} />

    <H>8. Ending your account</H>
    <P>
      You can delete your account at any time from Profile, Privacy and account. Rides in progress must finish first. Some records are kept
      after deletion as explained in the Privacy Policy. We may close accounts that breach these terms.
    </P>

    <H>9. Liability</H>
    <P>
      To the extent the law allows, KidRide is not liable for indirect or consequential losses, and our total liability for any claim is limited to
      the fares you paid in the 12 months before the claim. Nothing in these terms limits liability for death or personal injury caused by
      negligence, fraud, or anything else that cannot be limited by law, and nothing affects your statutory consumer rights.
      [LAWYER TO REVIEW: insurance, indemnities and liability caps.]
    </P>

    <H>10. Changes, law and contact</H>
    <P>
      We may update these terms. If changes are significant we will tell you in the app or by email before they take effect. These terms are governed by
      the laws of {LEGAL.governingLaw}. Questions: {LEGAL.supportEmail}.
    </P>
  </article>
);

export const PrivacyContent = () => (
  <article>
    <DraftNotice />
    <div className="mt-4"><Meta /></div>

    <H>1. Who we are</H>
    <P>
      {LEGAL.companyName} ({LEGAL.companyAddress}) is responsible for your personal data on KidRide (the "controller" under UK GDPR).
      Contact our privacy team at {LEGAL.privacyEmail}. UK/EU representative: {LEGAL.ukRepresentative}.
    </P>

    <H>2. Children's information</H>
    <P>
      KidRide is used by parents and guardians to arrange rides for their children. Children do not create accounts and we do not knowingly collect
      information directly from children. A parent gives us their child's first name, age and any notes needed for the ride, and the child's location
      is recorded during a ride because they are in the car.
    </P>
    <UL items={[
      'US (COPPA): the parent provides the child\'s details and consents to their use for rides when adding the child. Parents can review, change or delete their child\'s information at any time in the app, or by emailing us, and can refuse further collection by removing the child.',
      'UK (UK GDPR and the Children\'s Code): we collect only what a ride needs, keep children\'s data private by default, do not profile children, do not use it for marketing and do not sell or share it for advertising.',
      'Child notes such as allergies or medical needs may be health data. We use them only so the driver can look after the child on that ride, with the parent\'s explicit consent given when the notes are added.'
    ]} />

    <H>3. What we collect</H>
    <UL items={[
      <><strong>Account:</strong> name, email, phone, password (stored securely by our authentication provider), role.</>,
      <><strong>Children (parents):</strong> first name, age, notes you choose to add.</>,
      <><strong>Rides:</strong> pickup and drop-off addresses and coordinates, times, service, fare, status, trip code, ratings and cancellations.</>,
      <><strong>Location:</strong> a driver's live location while online and during rides; the ride's GPS trail; your location if you allow it when booking.</>,
      <><strong>Safety:</strong> SOS alerts, incident reports, route and stop alerts, trusted contacts (their name, phone and relationship, given by you).</>,
      <><strong>Drivers:</strong> licence, insurance, vehicle registration and photos, vehicle details, verification and background check results.</>,
      <><strong>Messages and notifications</strong> we send you, and Safety Assistant chats.</>,
      <><strong>Technical:</strong> session tokens, device and browser data needed to keep you signed in and protect the Service.</>
    ]} />

    <H>4. How we use it, and our legal bases</H>
    <UL items={[
      'To provide rides: booking, matching a driver, live tracking, fares, receipts (contract).',
      'To keep children safe: driver verification, trip codes, SOS, route alerts, incident investigation (legitimate interests, legal obligation, and vital interests in an emergency).',
      'To communicate about rides and your account (contract, legitimate interests).',
      'To meet legal, tax and regulatory duties (legal obligation).',
      'Child health notes and any background check data: explicit consent or as permitted by law.'
    ]} />
    <P>We do not sell personal data and do not use it for targeted advertising.</P>

    <H>5. Location data</H>
    <P>
      Drivers share location while online so nearby rides can be offered, and throughout a ride so the parent can follow it and safety alerts work.
      Parents can share location when booking to fill in the pickup address. Location sharing can be turned off in your device settings, but a driver
      cannot accept rides without it.
    </P>

    <H>6. Trusted contacts and SOS live links</H>
    <P>
      If you add trusted contacts, you confirm they agree to hear from us. When an SOS is raised, we may notify KidRide's safety team, the parent and your
      trusted contacts, and send them a time-limited link showing the ride's live location and driver and vehicle details. Links stop working when
      the ride ends or the link expires.
    </P>

    <H>7. Who we share with</H>
    <UL items={[
      'The other side of a ride: the driver sees the child\'s first name, age, notes and pickup/drop-off; the parent sees the driver\'s name, photo, vehicle and live location.',
      'Service providers acting for us: hosting and database (Supabase, Vercel), maps (Google Maps Platform), email (Resend), AI assistant (Google Gemini, Safety Assistant only), background check and payment providers when used. [LIST FINAL PROVIDERS.]',
      'Emergency services, police or regulators when the law requires or a child\'s safety is at risk.',
      'A buyer or successor if the business is sold, under the same protections.'
    ]} />
    <P>Some providers may process data outside your country. Where they do, we use safeguards such as standard contractual clauses or the UK International Data Transfer Addendum.</P>

    <H>8. How long we keep it</H>
    <UL items={[
      'Account and child details: while your account is open. Deleted when you delete your account.',
      `Ride, fare and safety records: ${LEGAL.rideRecordYears} years after the ride, for safety investigations, disputes, tax and legal claims. After account deletion these are kept without your name or contact details.`,
      `Detailed GPS trail of a ride: ${LEGAL.locationTrailDays} days, unless needed for an open safety investigation.`,
      'Driver documents and photos: while the driver is active; deleted when the driver deletes their account. Background check results are kept as long as the law requires.',
      'Notifications: deleted with the account.'
    ]} />

    <H>9. Your rights</H>
    <P>
      Depending on where you live you can access, correct, download, delete or restrict use of your data, object to some uses, and withdraw consent.
      In the app, Profile, Privacy and account lets you download your data and delete your account. You can also email {LEGAL.privacyEmail}.
      We reply within one month (UK) or as your local law requires. You can complain to the Information Commissioner's Office (ico.org.uk) in the UK,
      or your state attorney general or the FTC in the US. California residents have additional rights under the CCPA/CPRA. [LAWYER TO CONFIRM STATE LAWS.]
    </P>

    <H>10. Deleting your account</H>
    <P>
      When you delete your account we close your login, remove your name, email, phone, photo, children's names and notes, trusted contacts, notifications,
      and driver documents. Ride, fare and safety records other people rely on are kept without your personal details for the period above.
      Rides in progress must finish first; unstarted scheduled rides are cancelled.
    </P>

    <H>11. Security</H>
    <P>Data is encrypted in transit, access is restricted by role, and driver documents are stored privately. No system is perfectly secure; tell us at {LEGAL.supportEmail} if you notice anything wrong.</P>

    <H>12. Changes</H>
    <P>We will tell you in the app or by email before significant changes take effect.</P>
  </article>
);
