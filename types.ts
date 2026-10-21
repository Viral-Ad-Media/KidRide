export enum UserRole {
  PARENT = 'parent',
  DRIVER = 'driver',
  ADMIN = 'admin'
}

export enum RideStatus {
  REQUESTED = 'requested',
  SEARCHING_DRIVER = 'searching_driver',
  DRIVER_ASSIGNED = 'driver_assigned',
  DRIVER_ARRIVED = 'driver_arrived_at_pickup',
  IN_PROGRESS = 'child_picked_up',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ServiceType {
  PICKUP = 'pickup_only',
  DROPOFF = 'dropoff_only',
  BOTH = 'pickup_and_dropoff',
  STAY = 'stay_with_child_and_dropoff'
}

export interface Child {
  id: string;
  name: string;
  age: number;
  photoUrl?: string;
  notes?: string;
}

export interface VehicleDetails {
  make?: string;
  model?: string;
  year?: string;
  color?: string;
  plate?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  isVerifiedDriver?: boolean;
  isParentDriver?: boolean; // Can offer carpools
  photoUrl?: string;
  phone?: string;
  vehicle?: VehicleDetails;
  driverApplicationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  children?: Child[];
  /** Email on ride updates (on by default). */
  notifyEmail?: boolean;
}

export interface AppNotification {
  id: string;
  rideId: string | null;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface AssignedDriver {
  id: string;
  name: string;
  photoUrl?: string;
  phone?: string;
  isVerifiedDriver?: boolean;
  vehicle?: VehicleDetails;
}

export interface Driver {
  id: string;
  name: string;
  photoUrl: string;
  vehicle: VehicleDetails;
  rating: number;
  isVerified: boolean;
  isGoldVerified?: boolean; // Top tier
  isTeamParent?: boolean; // Parent driver
}

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  /** Degrees clockwise from north, when the device reports it. */
  heading?: number | null;
  /** Metres per second, when the device reports it. */
  speed?: number | null;
  recordedAt: string;
}

export interface PlaceCoords {
  lat: number;
  lng: number;
}

export interface RideRating {
  stars: number;
  comment?: string | null;
}

export type ScheduleState = 'scheduled' | 'dispatching' | 'assigned' | 'needs_attention';
export const SCHEDULE_STATES: ScheduleState[] = ['scheduled', 'dispatching', 'assigned', 'needs_attention'];

export interface Ride {
  driverLocation?: DriverLocation;
  /** 'targeted' while offered to the nearest drivers one at a time; 'open' when any driver may take it. */
  dispatchState?: 'targeted' | 'open';
  /** Booked for later (pickupTime is then the scheduled pickup). */
  isScheduled?: boolean;
  /** Rides for later: not yet offered to drivers, being offered, accepted, or no driver 5 min before pickup. */
  scheduleState?: ScheduleState | null;
  /** Driver view: when the offer made to this driver runs out. */
  offerExpiresAt?: string | null;
  /** Parent view while searching: online drivers near the pickup. */
  nearbyDrivers?: number | null;
  /** The parent's rating of this ride, when they have rated it. */
  rating?: RideRating | null;
  id: string;
  childId: string;
  driverId?: string;
  driver?: AssignedDriver;
  pickupLocation: string;
  dropoffLocation: string;
  /** Set when the address was picked from Google Places suggestions. */
  pickupCoords?: PlaceCoords | null;
  dropoffCoords?: PlaceCoords | null;
  pickupTime: string;
  status: RideStatus;
  price: number;
  tripCode: string;
  safeWord: string;
  serviceType: ServiceType;
}

export interface CarpoolOffer {
  id: string;
  parentId: string;
  parentName: string;
  parentPhoto: string;
  eventName: string;
  fromLocation: string;
  toLocation: string;
  departureTime: string;
  seatsAvailable: number;
  pricePerSeat: number;
  isTeamParent: boolean;
}
