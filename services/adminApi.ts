import { Ride, RideStatus } from '../types';
import { ApiError, RideScope, apiRequest, getStoredToken, mapRide } from './api';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface DriverApplicationVehicle {
  make?: string;
  model?: string;
  color?: string;
  plate?: string;
  year?: string | number;
}

export interface DriverApplicationSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle?: DriverApplicationVehicle;
  driverApplicationStatus: ApplicationStatus | string;
  submittedAt: string | null;
}

export type DocumentKey = 'license' | 'insurance' | 'registration' | 'photo_front' | 'photo_left' | 'photo_right';

export const DOCUMENT_LABELS: Record<DocumentKey, string> = {
  license: "Driver's license",
  insurance: 'Insurance',
  registration: 'Vehicle registration',
  photo_front: 'Photo (front)',
  photo_left: 'Photo (left)',
  photo_right: 'Photo (right)'
};

export interface DriverApplicationDetail {
  documents: Partial<Record<DocumentKey, string | null>>;
  submittedAt: string | null;
}

export interface AdminRide extends Ride {
  childName?: string;
  parentName?: string;
  parentEmail?: string;
  createdAt?: string;
}

const requireToken = (): string => {
  const token = getStoredToken();
  if (!token) {
    throw new ApiError('You are signed out. Please log in again.', 401, null);
  }
  return token;
};

const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));

const mapApplication = (raw: unknown): DriverApplicationSummary => {
  const app = (raw || {}) as Record<string, unknown>;
  const vehicle = app.vehicle && typeof app.vehicle === 'object' ? (app.vehicle as DriverApplicationVehicle) : undefined;
  return {
    id: str(app.id || app._id),
    name: str(app.name) || 'Unnamed applicant',
    email: str(app.email),
    phone: str(app.phone),
    vehicle,
    driverApplicationStatus: str(app.driverApplicationStatus) || 'pending',
    submittedAt: app.submittedAt ? str(app.submittedAt) : null
  };
};

const unwrapArray = (response: unknown, key: string): unknown[] => {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const nested = (response as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

export const fetchDriverApplications = async (status: ApplicationStatus): Promise<DriverApplicationSummary[]> => {
  const response = await apiRequest<unknown>(`/users/driver-applications?status=${encodeURIComponent(status)}`, {
    token: requireToken()
  });
  return unwrapArray(response, 'applications').map(mapApplication);
};

export const fetchDriverApplicationDetail = async (id: string): Promise<DriverApplicationDetail> => {
  const response = await apiRequest<Record<string, unknown>>(`/users/driver-applications/${encodeURIComponent(id)}`, {
    token: requireToken()
  });
  const documents = (response?.documents && typeof response.documents === 'object'
    ? response.documents
    : {}) as DriverApplicationDetail['documents'];
  return {
    documents,
    submittedAt: response?.submittedAt ? str(response.submittedAt) : null
  };
};

export const reviewDriverApplication = async (
  id: string,
  status: 'approved' | 'rejected',
  submittedAt: string | null
): Promise<unknown> => apiRequest(`/users/driver-applications/${encodeURIComponent(id)}/review`, {
  method: 'PUT',
  token: requireToken(),
  body: { status, submittedAt }
});

const mapAdminRide = (raw: unknown): AdminRide => {
  const base = mapRide(raw);
  const ride = (raw || {}) as Record<string, unknown>;
  const child = ride.child && typeof ride.child === 'object' ? (ride.child as Record<string, unknown>) : undefined;
  const parent = ride.parent && typeof ride.parent === 'object' ? (ride.parent as Record<string, unknown>) : undefined;
  return {
    ...base,
    childName: child ? str(child.name) || undefined : undefined,
    parentName: parent ? str(parent.name) || undefined : undefined,
    parentEmail: parent ? str(parent.email) || undefined : undefined,
    createdAt: ride.createdAt ? str(ride.createdAt) : undefined
  };
};

export const fetchAdminRides = async (scope: RideScope, limit = 100): Promise<AdminRide[]> => {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const response = await apiRequest<unknown>(`/rides?scope=${scope}&limit=${safeLimit}`, { token: requireToken() });
  return unwrapArray(response, 'rides').map(mapAdminRide);
};

export const adminCancelRide = async (id: string): Promise<unknown> => apiRequest(`/rides/${encodeURIComponent(id)}/cancel`, {
  method: 'PUT',
  token: requireToken()
});

export const adminOverrideRideStatus = async (id: string, status: RideStatus): Promise<unknown> => apiRequest(
  `/rides/${encodeURIComponent(id)}/status`,
  { method: 'PUT', token: requireToken(), body: { status } }
);

export const TERMINAL_RIDE_STATUSES: RideStatus[] = [RideStatus.COMPLETED, RideStatus.CANCELLED];

export const errorMessage = (error: unknown, fallback = 'Something went wrong.'): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};
