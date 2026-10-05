# KidRide Web

React 19 + TypeScript + Vite frontend for parent and driver workflows. Production frontend: `https://kid-ride.vercel.app`. Default API: `https://kidride-backend.vercel.app/api`.

## Development

```sh
npm ci
npm run dev
npx tsc --noEmit
npm run build
npm run preview
```

Use Node.js 22 or newer. Set `VITE_API_BASE_URL=http://localhost:5000/api` for a local backend. URL resolution uses the `kidride_api_base_url` localStorage override first, then `VITE_API_BASE_URL`, then localhost/production defaults. Ensure the backend's `FRONTEND_URLS` includes the browser origin.

**Do not configure a frontend Gemini secret.** Safety chat calls the authenticated backend `/api/safety-chat` proxy. Remove old `GEMINI_API_KEY` frontend settings and revoke any key previously shipped in a bundle.

## Layout

| Directory | Purpose |
| --- | --- |
| `pages` | Parent/driver pages and static information |
| `components` | Layout, controls, camera capture, GPS display |
| `contexts` | Session restoration and guarded ride state |
| `services` | API client, server-side safety chat, signed uploads, driver GPS |
| `utils` | Ride summaries and display helpers |

## Backend dependency and deployment

1. Apply the backend's `supabase/migrations/2026-10-04_security_services.sql`. Resolve any duplicate active rides through operator review if the migration aborts.
2. Configure backend Supabase/JWT credentials, CORS, positive fixed USD fares in `SERVICE_PRICES_JSON`, and the backend `GEMINI_API_KEY`.
3. Deploy the coordinated backend update, then this frontend. Old backend versions lack quotes, document uploads, GPS reporting, and safety chat.
4. Build with only public frontend configuration. See the backend README for admin provisioning, private document review, push services, and production rate limiting.

## Authentication and driver approval

`AuthContext` restores sessions with `/auth/me`; the web JWT and cached profile are stored in localStorage. Public registration supports parents and drivers only. Driver routes require an approved application and verified-driver flag; the backend repeats these checks for offers and acceptance.

Driver onboarding uploads license, insurance, registration, and front/left/right photos through short-lived signed URLs to private storage. JPEG/PNG/PDF files are limited to 5 MB; photos must be images. No unused SSN is collected. These photos support manual review, not automated liveness detection. Application submission does not perform a background check or grant approval. Pending drivers see the review state; sign out/sign in to refresh the result after review.

## Booking and trip state

Parents select a saved child, route, and service, then obtain a server quote before confirming. The backend checks child ownership, uses configured fixed service fares, and ignores client fare manipulation. Missing pricing blocks booking instead of creating a zero-fare ride. Payment collection and distance-based pricing are not implemented.

Ride updates poll every seven seconds. Network failures preserve the last saved trip and show an interruption notice. Session/version guards prevent older responses from overwriting a mutation or leaking previous-account trip state. Cancellation is available before pickup; the backend prevents ordinary cancellation with a child onboard. Active rides remain visible when the driver's offer availability toggle is off.

## Location and safety

Assigned approved drivers report browser GPS while their driver workspace is open and visible. Grant location permission and keep the page open. Parents see actual timestamped GPS on an OpenStreetMap embed. GPS older than 30 seconds is labelled stale; missing coordinates show a waiting state. The embed sends displayed coordinates to OpenStreetMap. Background/closed-browser tracking is not implemented.

Tracking routes check the requested ride ID against the active ride; an unrelated ID does not display another trip. Open ride offers omit trip codes, safe words, parent identity, and child identifiers. Assigned participants receive the safety credentials.

Safety chat is general guidance, not emergency dispatch. Direct driver contact and the carpool publishing workflow remain unimplemented. Earnings represent completed fares rather than paid-out balances.

## Routes

| Access | Routes |
| --- | --- |
| Public | `/`, `/about`, `/help`, `/contact`, `/privacy`, `/terms`, `/drive`, `/driver-signup` |
| Parent | `/dashboard`, `/add-child`, `/book`, `/rides`, `/carpools` |
| Approved driver | `/driver-dashboard`, `/driver-map`, `/earnings` |
| Signed-in | `/tracking/:id`, `/safety`, `/profile`, `/profile/notifications`, `/profile/payments` |

HashRouter is used for static hosting. Route visibility is not a substitute for backend authorization.

## Release checks

Run the type check and production build, then verify signup/login, owned-child booking, quote errors, private uploads, pending/approved routing, ride status progression, cancellation, location denial/staleness, interrupted polling, and account switching. Physical-device and deployed-service tests are still required before operational use.
