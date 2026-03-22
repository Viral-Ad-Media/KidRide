import { Ride, RideStatus } from '../types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const toDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const hasRidePrice = (price: number): boolean => Number.isFinite(price) && price > 0;

export const formatRidePrice = (price: number, fallback = 'Pricing pending'): string => (
  hasRidePrice(price) ? currencyFormatter.format(price) : fallback
);

export const getCompletedRideSummary = (rides: Ride[]) => {
  const completedRides = rides.filter((ride) => ride.status === RideStatus.COMPLETED);
  const completedCount = completedRides.length;
  const totalEarnings = completedRides.reduce((sum, ride) => sum + (hasRidePrice(ride.price) ? ride.price : 0), 0);

  return {
    completedRides,
    completedCount,
    totalEarnings
  };
};

export const buildWeeklyRideCounts = (rides: Ride[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    return {
      name: date.toLocaleDateString('en-US', { weekday: 'short' }),
      key: toDayKey(date),
      rides: 0
    };
  });

  const dayIndex = new Map(days.map((day, index) => [day.key, index]));

  rides.forEach((ride) => {
    const parsedDate = Date.parse(ride.pickupTime);
    if (Number.isNaN(parsedDate)) {
      return;
    }

    const rideKey = toDayKey(new Date(parsedDate));
    const index = dayIndex.get(rideKey);
    if (index === undefined) {
      return;
    }

    days[index].rides += 1;
  });

  return days.map(({ name, rides }) => ({ name, rides }));
};
