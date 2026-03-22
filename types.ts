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
  driverApplicationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  children?: Child[];
}

export interface AssignedDriver {
  id: string;
  name: string;
  photoUrl?: string;
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

export interface Ride {
  id: string;
  childId: string;
  driverId?: string;
  driver?: AssignedDriver;
  pickupLocation: string;
  dropoffLocation: string;
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
