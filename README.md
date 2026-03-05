# KidRide Frontend

Frontend application for KidRide parent and driver experiences.

## Production
- Frontend URL: `https://kid-ride.vercel.app/`
- Backend API URL: `https://kidride-backend.vercel.app/api`

## What This App Includes
- Parent flow: dashboard, add child, book ride, ride history, live tracking, profile.
- Driver flow: driver landing, application onboarding, job dashboard, status progression.
- Safety assistant chat powered by Gemini (`@google/genai`).
- Auth and ride state managed through React Context and backed by live backend endpoints.

## Tech Stack
- React 19 + TypeScript
- Vite 6
- React Router (HashRouter)
- Recharts
- Lucide React icons

## Project Structure
```text
kidride/
  components/       # Reusable UI and layout
  contexts/         # AuthContext and RideContext (API-backed state)
  pages/            # Parent + driver screens
  services/         # API client and Gemini service
  App.tsx           # Route map
  vite.config.ts    # Dev server and build config
```

## Prerequisites
- Node.js 18+ (Node.js 20+ recommended)
- npm

## Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local`:
   ```bash
   GEMINI_API_KEY=your_gemini_key
   ```
3. Optional API override:
   ```bash
   VITE_API_BASE_URL=http://localhost:5000
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```
6. Preview build output:
   ```bash
   npm run preview
   ```

## Environment Variables
- `GEMINI_API_KEY` (required for Safety Chat)
- `VITE_API_BASE_URL` (optional, frontend API override)

## API Base URL Resolution
`services/api.ts` resolves API base URL in this order:
1. `localStorage.kidride_api_base_url`
2. `VITE_API_BASE_URL` from build env
3. Local fallback (`http://localhost:5000/api`) when host is `localhost` or `127.0.0.1`
4. Production fallback (`https://kidride-backend.vercel.app/api`) for non-local hosts

If `VITE_API_BASE_URL` does not end with `/api`, the app appends it automatically.

## Auth and Session Behavior
- Demo login buttons in `Welcome` authenticate against backend demo credentials.
- Token is stored in `localStorage` as `kidride_token`.
- User profile cache is stored as `kidride_user`.
- On app load, `AuthContext` calls `GET /api/auth/me` to refresh session state.

## Ride Behavior
- `RideContext` polls active ride state from backend.
- Parent ride requests call `POST /api/rides/request`.
- Driver accept and status updates call:
  - `PUT /api/rides/:id/accept`
  - `PUT /api/rides/:id/status`
  - `PUT /api/rides/:id/cancel`

## Frontend Routes
- `/` Welcome
- `/dashboard` Parent dashboard
- `/add-child` Add child profile
- `/book` Book ride
- `/rides` Ride history
- `/tracking/:id` Live tracking
- `/safety` Safety assistant
- `/profile` Profile
- `/profile/notifications` Notification settings
- `/profile/payments` Payment methods
- `/drive` Driver landing
- `/driver-signup` Driver application
- `/driver-dashboard` Driver dashboard
- `/driver-map` Driver map placeholder
- `/earnings` Driver earnings placeholder

## Deployment Notes
- Uses `HashRouter`, which is friendly for static hosting.
- Ensure backend CORS `FRONTEND_URLS` includes your frontend origin.

## Troubleshooting
- `401 Not authorized`: clear `kidride_token` and `kidride_user` in browser storage, then log in again.
- CORS errors: add frontend URL to backend `FRONTEND_URLS`.
- Gemini errors in Safety Chat: verify `GEMINI_API_KEY` exists in `.env.local`.
