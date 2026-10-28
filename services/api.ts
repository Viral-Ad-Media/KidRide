import { AssignedDriver, Child, Ride, RideStatus, SafetyAlert, SCHEDULE_STATES, ScheduleState, ServiceType, User, UserRole, VehicleDetails } from '../types';

const LOCAL_API_BASE_URL = 'http://localhost:5000/api';
const DEPLOYED_API_BASE_URL = 'https://kidride-backend.vercel.app/api';
const TOKEN_STORAGE_KEY = 'kidride_token';

const validRideStatuses = new Set<string>(Object.values(RideStatus));
const validServiceTypes = new Set<string>(Object.values(ServiceType));
const validRoles = new Set<string>(Object.values(UserRole));

export type RideScope = 'all' | 'active' | 'upcoming' | 'past';

export const SESSION_ENDED_EVENT = 'kidride:session-ended';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const normalizeApiBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return DEPLOYED_API_BASE_URL;
  }

  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const getEnvApiBaseUrl = (): string | null => {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const candidate = viteEnv?.VITE_API_BASE_URL;
  if (!candidate || !candidate.trim()) {
    return null;
  }

  return normalizeApiBaseUrl(candidate);
};

const getDefaultApiBaseUrl = (): string => {
  const envBaseUrl = getEnvApiBaseUrl();
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return LOCAL_API_BASE_URL;
    }
  }

  return DEPLOYED_API_BASE_URL;
};

export const getApiBaseUrl = (): string => {
  const configured = typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('kidride_api_base_url');

  if (configured && configured.trim()) {
    return normalizeApiBaseUrl(configured);
  }

  return getDefaultApiBaseUrl();
};

export const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setStoredToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
};

export const clearStoredToken = (): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

type RequestBody = BodyInit | Record<string, unknown> | null | undefined;

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: RequestBody;
  token?: string | null;
  /** How long to wait before giving up (default 20 s). */
  timeoutMs?: number;
}

const isRawBody = (body: RequestBody): body is BodyInit => (
  body instanceof FormData ||
  body instanceof URLSearchParams ||
  typeof body === 'string' ||
  body instanceof Blob ||
  body instanceof ArrayBuffer ||
  ArrayBuffer.isView(body)
);

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const { token, body, headers, timeoutMs = 20000, ...rest } = options;
  const resolvedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${resolvedPath}`;
  const requestHeaders = new Headers(headers || {});

  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const init: RequestInit = {
    ...rest,
    headers: requestHeaders
  };

  if (body !== undefined && body !== null) {
    if (isRawBody(body)) {
      init.body = body;
    } else {
      requestHeaders.set('Content-Type', 'application/json');
      init.body = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    // Raw fetch errors ("signal timed out", "Failed to fetch") mean nothing to users.
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ApiError('The server is taking too long to respond. Please try again.', 0, null);
    }
    throw new ApiError('Could not reach the KidRide server. Check your connection and try again.', 0, null);
  }
  const text = await response.text();

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message = (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof (payload as { message?: unknown }).message === 'string'
    ) ? (payload as { message: string }).message : `Request failed with status ${response.status}`;

    // A blocked account or a revoked token ends the session everywhere in the app.
    const code = typeof payload === 'object' && payload !== null ? (payload as { code?: unknown }).code : undefined;
    if (token && (code === 'account_blocked' || response.status === 401) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { message } }));
    }
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
};

export interface DriverSummary {
  completedCount: number;
  totalEarnings: number;
}

/** Server-side totals over every completed ride, not just the latest 100. */
export const fetchDriverSummary = async (token: string): Promise<DriverSummary> => {
  const response = await apiRequest<Partial<DriverSummary>>('/rides/summary', { token });
  return {
    completedCount: Number(response?.completedCount) || 0,
    totalEarnings: Number(response?.totalEarnings) || 0
  };
};

/** Invalidates every token issued to this account; failures are non-fatal for logout. */
export const revokeSession = async (token: string): Promise<void> => {
  await apiRequest('/auth/logout', { method: 'POST', token });
};

export const fetchUserRides = async (
  scope: RideScope,
  token: string,
  limit = 50
): Promise<Ride[]> => {
  const response = await apiRequest<unknown[]>(`/rides?scope=${scope}&limit=${limit}`, { token });
  return Array.isArray(response) ? response.map(mapRide) : [];
};

const normalizeRole = (role: unknown): UserRole => {
  if (typeof role === 'string' && validRoles.has(role)) {
    return role as UserRole;
  }
  return UserRole.PARENT;
};

const mapVehicle = (raw: unknown): VehicleDetails | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const vehicle = raw as Record<string, unknown>;
  const mappedVehicle: VehicleDetails = {
    make: typeof vehicle.make === 'string' ? vehicle.make : undefined,
    model: typeof vehicle.model === 'string' ? vehicle.model : undefined,
    color: typeof vehicle.color === 'string' ? vehicle.color : undefined,
    plate: typeof vehicle.plate === 'string' ? vehicle.plate : undefined
  };

  return Object.values(mappedVehicle).some(Boolean) ? mappedVehicle : undefined;
};

const mapAssignedDriver = (raw: unknown): AssignedDriver | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const driver = raw as Record<string, unknown>;
  const driverId = driver.id || driver._id;
  if (!driverId) {
    return undefined;
  }

  return {
    id: String(driverId),
    name: typeof driver.name === 'string' && driver.name.trim() ? driver.name : 'Assigned driver',
    photoUrl: typeof driver.photoUrl === 'string' ? driver.photoUrl : undefined,
    phone: typeof driver.phone === 'string' && driver.phone.trim() ? driver.phone : undefined,
    isVerifiedDriver: Boolean(driver.isVerifiedDriver),
    vehicle: mapVehicle(driver.vehicle)
  };
};

export const mapChild = (raw: unknown): Child => {
  const child = (raw || {}) as Record<string, unknown>;
  const childId = child.id || child._id;

  return {
    id: childId ? String(childId) : `child-${Date.now()}`,
    name: typeof child.name === 'string' ? child.name : 'Child',
    age: typeof child.age === 'number' ? child.age : Number(child.age || 0),
    notes: typeof child.notes === 'string' ? child.notes : undefined,
    photoUrl: typeof child.photoUrl === 'string' ? child.photoUrl : undefined
  };
};

export const mapUser = (raw: unknown): User => {
  const user = (raw || {}) as Record<string, unknown>;
  const userId = user.id || user._id;

  return {
    id: userId ? String(userId) : `user-${Date.now()}`,
    name: typeof user.name === 'string' ? user.name : 'KidRide User',
    email: typeof user.email === 'string' ? user.email : '',
    role: normalizeRole(user.role),
    photoUrl: typeof user.photoUrl === 'string' ? user.photoUrl : undefined,
    phone: typeof user.phone === 'string' ? user.phone : undefined,
    vehicle: user.vehicle && typeof user.vehicle === 'object' ? user.vehicle as VehicleDetails : undefined,
    isVerifiedDriver: Boolean(user.isVerifiedDriver),
    notifyEmail: user.notifyEmail !== false,
    driverApplicationStatus:
      user.driverApplicationStatus === 'pending' ||
      user.driverApplicationStatus === 'approved' ||
      user.driverApplicationStatus === 'rejected'
        ? user.driverApplicationStatus
        : 'none',
    children: Array.isArray(user.children) ? user.children.map(mapChild) : []
  };
};

const formatPickupTime = (value: unknown): string => {
  if (!value) {
    return new Date().toLocaleTimeString();
  }

  if (typeof value === 'string') {
    const parsedDate = Date.parse(value);
    if (Number.isNaN(parsedDate)) {
      return value;
    }
    return new Date(parsedDate).toLocaleString();
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  const parsedDate = new Date(String(value));
  return Number.isNaN(parsedDate.getTime()) ? new Date().toLocaleTimeString() : parsedDate.toLocaleString();
};

const SAFETY_ALERTS: SafetyAlert[] = ['sos', 'trip_code', 'off_route', 'stalled'];

export const mapRide = (raw: unknown): Ride => {
  const ride = (raw || {}) as Record<string, unknown>;
  const rideId = ride.id || ride._id;
  const rawDriver = ride.driver as Record<string, unknown> | string | undefined;
  const rawChild = ride.child as Record<string, unknown> | string | undefined;
  const rawStatus = typeof ride.status === 'string' ? ride.status : RideStatus.REQUESTED;
  const rawServiceType = typeof ride.serviceType === 'string' ? ride.serviceType : ServiceType.PICKUP;

  const driverId = typeof rawDriver === 'string'
    ? rawDriver
    : rawDriver?._id
      ? String(rawDriver._id)
      : undefined;
  const driver = typeof rawDriver === 'string' ? undefined : mapAssignedDriver(rawDriver);
  const childId = typeof rawChild === 'string'
    ? rawChild
    : rawChild?._id
      ? String(rawChild._id)
      : '';

  return {
    id: rideId ? String(rideId) : `ride-${Date.now()}`,
    childId,
    driverId,
    driver,
    pickupLocation: typeof ride.pickupLocation === 'string' ? ride.pickupLocation : '',
    dropoffLocation: typeof ride.dropoffLocation === 'string' ? ride.dropoffLocation : '',
    pickupTime: typeof ride.pickupTime === 'string' ? ride.pickupTime : '',
    driverLocation: typeof ride.driverLocation === 'object' && ride.driverLocation !== null ? ride.driverLocation as Ride['driverLocation'] : undefined,
    status: validRideStatuses.has(rawStatus) ? (rawStatus as RideStatus) : RideStatus.REQUESTED,
    price: typeof ride.price === 'number' ? ride.price : Number(ride.price || 0),
    currency: typeof ride.currency === 'string' ? ride.currency : 'USD',
    fare: ride.fare && typeof ride.fare === 'object' && Array.isArray((ride.fare as { lines?: unknown }).lines) ? ride.fare as Ride['fare'] : null,
    driverEarnings: typeof ride.driverEarnings === 'number' ? ride.driverEarnings : undefined,
    cancellationFee: typeof ride.cancellationFee === 'number' ? ride.cancellationFee : 0,
    tripCode: typeof ride.tripCode === 'string' ? ride.tripCode : '',
    safeWord: typeof ride.safeWord === 'string' ? ride.safeWord : '',
    rating: ride.rating && typeof ride.rating === 'object' ? ride.rating as Ride['rating'] : null,
    pickupCoords: ride.pickupCoords && typeof ride.pickupCoords === 'object' ? ride.pickupCoords as Ride['pickupCoords'] : null,
    dispatchState: ride.dispatchState === 'targeted' ? 'targeted' : 'open',
    isScheduled: ride.isScheduled === true,
    scheduleState: typeof ride.scheduleState === 'string' && SCHEDULE_STATES.includes(ride.scheduleState as ScheduleState) ? ride.scheduleState as ScheduleState : null,
    offerExpiresAt: typeof ride.offerExpiresAt === 'string' ? ride.offerExpiresAt : null,
    nearbyDrivers: ride.dispatch && typeof (ride.dispatch as { nearbyDrivers?: unknown }).nearbyDrivers === 'number' ? (ride.dispatch as { nearbyDrivers: number }).nearbyDrivers : null,
    dropoffCoords: ride.dropoffCoords && typeof ride.dropoffCoords === 'object' ? ride.dropoffCoords as Ride['dropoffCoords'] : null,
    arrivedAt: typeof ride.arrivedAt === 'string' ? ride.arrivedAt : null,
    tripCodeVerified: ride.tripCodeVerified === true,
    tripCodeAttempts: typeof ride.tripCodeAttempts === 'number' ? ride.tripCodeAttempts : 0,
    safetyAlert: typeof ride.safetyAlert === 'string' && SAFETY_ALERTS.includes(ride.safetyAlert as SafetyAlert) ? ride.safetyAlert as SafetyAlert : null,
    safetyAlertAt: typeof ride.safetyAlertAt === 'string' ? ride.safetyAlertAt : null,
    cancelReason: ride.cancelReason === 'no_show' ? 'no_show' : null,
    serviceType: validServiceTypes.has(rawServiceType)
      ? (rawServiceType as ServiceType)
      : ServiceType.PICKUP
  };
};
