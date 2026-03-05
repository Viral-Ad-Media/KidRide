import { Child, Driver, CarpoolOffer, Ride, RideStatus, ServiceType } from './types';

// Brand Colors
export const COLORS = {
  primary: '#3A77FF',
  secondary: '#6C63FF',
  accent: '#FFA93A',
  success: '#26C281',
  warning: '#FFA93A',
  error: '#FF4F4F',
  gray900: '#1A1D26',
  gray100: '#F7F9FC',
};

export const MOCK_CHILDREN: Child[] = [
  { id: 'c1', name: 'Leo', age: 8, photoUrl: 'https://picsum.photos/100/100?random=1', notes: 'Peanut allergy' },
  { id: 'c2', name: 'Maya', age: 12, photoUrl: 'https://picsum.photos/100/100?random=2' },
];

export const MOCK_DRIVERS: Driver[] = [
  {
    id: 'd1',
    name: 'Sarah Jenkins',
    photoUrl: 'https://picsum.photos/100/100?random=3',
    rating: 4.9,
    isVerified: true,
    isGoldVerified: true,
    vehicle: { make: 'Toyota', model: 'Sienna', color: 'Silver', plate: 'KID-SAFE' }
  },
  {
    id: 'd2',
    name: 'Mike Ross',
    photoUrl: 'https://picsum.photos/100/100?random=4',
    rating: 4.7,
    isVerified: true,
    vehicle: { make: 'Honda', model: 'Odyssey', color: 'Blue', plate: 'ABC-1234' }
  },
  {
    id: 'd3', // Parent Driver
    name: 'Sandra (Maya’s Mom)',
    photoUrl: 'https://picsum.photos/100/100?random=5',
    rating: 5.0,
    isVerified: true,
    isTeamParent: true,
    vehicle: { make: 'Volvo', model: 'XC90', color: 'White', plate: 'SOC-MOM' }
  }
];

export const MOCK_CARPOOLS: CarpoolOffer[] = [
  {
    id: 'cp1',
    parentId: 'd3',
    parentName: 'Sandra (Maya’s Mom)',
    parentPhoto: 'https://picsum.photos/100/100?random=5',
    eventName: 'U12 Soccer Finals',
    fromLocation: 'Lincoln Elementary',
    toLocation: 'City Sports Complex',
    departureTime: 'Sat, 9:00 AM',
    seatsAvailable: 2,
    pricePerSeat: 5,
    isTeamParent: true
  },
  {
    id: 'cp2',
    parentId: 'p5',
    parentName: 'Coach Dave',
    parentPhoto: 'https://picsum.photos/100/100?random=6',
    eventName: 'Basketball Practice',
    fromLocation: 'Community Center',
    toLocation: 'Westside Gym',
    departureTime: 'Tue, 5:30 PM',
    seatsAvailable: 3,
    pricePerSeat: 0,
    isTeamParent: true
  }
];

export const INITIAL_RIDES: Ride[] = [
  {
    id: 'r1',
    childId: 'c1',
    driverId: 'd1',
    pickupLocation: 'Home',
    dropoffLocation: 'Piano Lesson',
    pickupTime: 'Today, 3:30 PM',
    status: RideStatus.COMPLETED,
    price: 15.50,
    tripCode: '8821',
    safeWord: 'Tiger',
    serviceType: ServiceType.DROPOFF
  }
];
