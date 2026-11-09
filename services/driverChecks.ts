import { apiRequest, getStoredToken } from './api';

// Driver verification checks: identity with the ID provider, face checks with
// random actions, and live photos (car, plate, licence, current location).

export type CheckKind = 'identity' | 'liveness' | 'id_document' | 'vehicle_photo' | 'plate_photo' | 'location_photo';
export type CheckStatus = 'pending' | 'submitted' | 'passed' | 'failed' | 'cancelled';
export type LivenessAction = 'turn_left' | 'turn_right' | 'open_mouth' | 'nod' | 'blink' | 'smile';

export interface DriverCheck {
  id: string;
  driverId: string;
  kind: CheckKind;
  reason: string;
  reasonLabel: string;
  clears: 'submit' | 'review' | 'provider';
  status: CheckStatus;
  rideId: string | null;
  details: Record<string, unknown>;
  blocksDriving: boolean;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  driver?: { id: string; name: string; email: string; vehicle: Record<string, string> } | null;
}

export interface IdentityState {
  status: 'none' | 'pending' | 'processing' | 'requires_input' | 'verified';
  verifiedAt: string | null;
  error: { code: string | null; reason: string | null } | null;
  providerReady: boolean;
}

export const CHECK_LABELS: Record<CheckKind, string> = {
  identity: 'ID and selfie',
  liveness: 'Face check',
  id_document: 'Licence photo',
  vehicle_photo: 'Car photo',
  plate_photo: 'Licence plate photo',
  location_photo: 'Where you are now'
};

export const CHECK_HELP: Record<CheckKind, string> = {
  identity: 'Scan your driving licence and take a selfie. Our ID partner checks that the face matches the licence.',
  liveness: 'Look at the camera and follow three quick prompts so we know it is really you.',
  id_document: 'Take a live photo of the front of your driving licence.',
  vehicle_photo: 'Take a live photo of your car from the front, with the whole car in view.',
  plate_photo: 'Take a close, readable photo of your licence plate.',
  location_photo: 'Take a photo of your surroundings. We record your GPS position with it.'
};

export const ACTION_PROMPTS: Record<LivenessAction, string> = {
  turn_left: 'Turn your head to your left',
  turn_right: 'Turn your head to your right',
  open_mouth: 'Open your mouth',
  nod: 'Nod your head',
  blink: 'Blink both eyes',
  smile: 'Smile'
};

const token = () => getStoredToken();

export const fetchMyChecks = () => apiRequest<{ identity: IdentityState; checks: DriverCheck[]; blocked: boolean }>('/driver-checks', { token: token() });
export const startIdentity = () => apiRequest<{ url: string }>('/driver-checks/identity/start', { method: 'POST', token: token() });
export const refreshIdentity = () => apiRequest<IdentityState>('/driver-checks/identity/refresh', { method: 'POST', token: token() });
export const startCheck = (id: string) => apiRequest<{ checkId: string; kind: CheckKind; actions?: LivenessAction[]; expiresAt: string }>(`/driver-checks/${id}/start`, { method: 'POST', token: token() });

/** Uploads one captured photo for a check and returns its storage path. */
export const uploadCheckPhoto = async (checkId: string, slot: string, blob: Blob): Promise<string> => {
  const { path, signedUrl } = await apiRequest<{ path: string; signedUrl: string }>(`/driver-checks/${checkId}/upload-url`, { method: 'POST', token: token(), body: { slot, contentType: blob.type || 'image/jpeg' } });
  const response = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': blob.type || 'image/jpeg' }, body: blob, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Photo upload failed (HTTP ${response.status}). Try again.`);
  return path;
};

export const submitCheck = (checkId: string, body: { files: Record<string, string>; position?: { latitude: number; longitude: number; accuracy: number } | null; method?: 'detected' | 'manual' }) =>
  apiRequest<DriverCheck>(`/driver-checks/${checkId}/submit`, { method: 'POST', token: token(), body });

// Admin.
export const fetchAdminChecks = (status: 'submitted' | 'open' | 'all') => apiRequest<{ checks: DriverCheck[] }>(`/admin/verification/checks?status=${status}`, { token: token() });
export const fetchAdminCheck = (id: string) => apiRequest<{ check: DriverCheck; evidence: Record<string, string | null>; reference: Record<string, string | null>; driver: { name: string; email: string; vehicle: Record<string, string>; identity_status: string; identity_verified_at: string | null } }>(`/admin/verification/checks/${id}`, { token: token() });
export const reviewCheck = (id: string, result: 'passed' | 'failed' | 'cancelled', note?: string) => apiRequest<DriverCheck>(`/admin/verification/checks/${id}/review`, { method: 'PUT', token: token(), body: { result, note } });
export const requestChecks = (driverId: string, kinds: CheckKind[], note?: string) => apiRequest<{ checks: DriverCheck[] }>('/admin/verification/request', { method: 'POST', token: token(), body: { driverId, kinds, note } });
export const fetchRules = () => apiRequest<{ rules: { reason: string; label: string; checks: CheckKind[]; clears: string; repeat?: { count: number; days: number; checks: CheckKind[]; clears: string } }[] }>('/admin/verification/rules', { token: token() });

/** One frame of a playing video as a JPEG. mirror flips it to match what the driver saw. */
export const grabFrame = (video: HTMLVideoElement): Promise<Blob> => new Promise((resolve, reject) => {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not take the photo'))), 'image/jpeg', 0.85);
});

export const currentPosition = () => new Promise<GeolocationPosition | null>((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
});
