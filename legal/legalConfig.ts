// Fill these in before launch. Every legal page reads from here, so the
// company details only need changing in one place.
// The Terms and Privacy Policy are DRAFTS: have a lawyer review them for the
// country and state/region KidRide launches in before going live.
export const LEGAL = {
  isDraft: true,
  version: '2026-11-06-draft', // keep in step with TERMS_VERSION in kidride-backend/lib/account.js
  effectiveDate: '[EFFECTIVE DATE]',
  companyName: '[COMPANY LEGAL NAME]',
  companyAddress: '[REGISTERED ADDRESS]',
  supportEmail: '[SUPPORT EMAIL]',
  privacyEmail: '[PRIVACY EMAIL]',
  governingLaw: '[GOVERNING LAW, e.g. the State of Texas, USA / England and Wales]',
  ukRepresentative: '[UK/EU REPRESENTATIVE, if required]',
  rideRecordYears: 7, // [CONFIRM WITH LAWYER] ride, payment and safety records
  locationTrailDays: 90 // [CONFIRM WITH LAWYER] detailed GPS trail of each ride
};
