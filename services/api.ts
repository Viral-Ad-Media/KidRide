import { Child, Ride, RideStatus, ServiceType, User, UserRole } from '../types';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api';
const TOKEN_STORAGE_KEY = 'kidride_token';

const validRideStatuses = new Set<string>(Object.values(RideStatus));
const validServiceTypes = new Set<string>(Object.values(ServiceType));
const validRoles = new Set<string>(Object.values(UserRole));

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

export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return DEFAULT_API_BASE_URL;
  }

  const configured = window.localStorage.getItem('kidride_api_base_url');
  if (!configured || !configured.trim()) {
    return DEFAULT_API_BASE_URL;
  }

  return configured.trim().replace(/\/+$/, '');
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
  const { token, body, headers, ...rest } = options;
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

  const response = await fetch(url, init);
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

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
};

const normalizeRole = (role: unknown): UserRole => {
  if (typeof role === 'string' && validRoles.has(role)) {
    return role as UserRole;
  }
  return UserRole.PARENT;
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
    isVerifiedDriver: Boolean(user.isVerifiedDriver),
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
  const childId = typeof rawChild === 'string'
    ? rawChild
    : rawChild?._id
      ? String(rawChild._id)
      : '';

  return {
    id: rideId ? String(rideId) : `ride-${Date.now()}`,
    childId,
    driverId,
    pickupLocation: typeof ride.pickupLocation === 'string' ? ride.pickupLocation : '',
    dropoffLocation: typeof ride.dropoffLocation === 'string' ? ride.dropoffLocation : '',
    pickupTime: formatPickupTime(ride.pickupTime),
    status: validRideStatuses.has(rawStatus) ? (rawStatus as RideStatus) : RideStatus.REQUESTED,
    price: typeof ride.price === 'number' ? ride.price : Number(ride.price || 0),
    tripCode: typeof ride.tripCode === 'string' ? ride.tripCode : '',
    safeWord: typeof ride.safeWord === 'string' ? ride.safeWord : '',
    serviceType: validServiceTypes.has(rawServiceType)
      ? (rawServiceType as ServiceType)
      : ServiceType.PICKUP
  };
};
