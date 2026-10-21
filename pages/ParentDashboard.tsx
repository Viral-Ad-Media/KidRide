import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { ArrowRight, Car, Plus, ShieldCheck } from 'lucide-react';
import { Button, Card, StatusChip } from '../components/UIComponents';
import { useAuth } from '../contexts/AuthContext';
import { useRide } from '../contexts/RideContext';
import { fetchUserRides, getStoredToken } from '../services/api';
import { buildWeeklyRideCounts } from '../utils/rideData';
import { ParentUpcomingRides } from '../components/UpcomingRides';

const emptyWeeklyActivity = buildWeeklyRideCounts([]);

const childInitials = (name: string) => (
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'C'
);

export const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeRide } = useRide();
  const [activityData, setActivityData] = useState(emptyWeeklyActivity);
  const [isActivityLoading, setIsActivityLoading] = useState(true);

  const availableChildren = user?.children || [];
  const hasChildren = availableChildren.length > 0;
  const primaryActionPath = hasChildren ? '/book' : '/add-child';
  const hasRecordedActivity = activityData.some((entry) => entry.rides > 0);
  const firstName = user?.name.split(' ')[0] || 'Parent';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setActivityData(emptyWeeklyActivity);
      setIsActivityLoading(false);
      return;
    }

    let isMounted = true;

    const loadActivity = async () => {
      setIsActivityLoading(true);

      try {
        const rides = await fetchUserRides('all', token, 100);
        if (!isMounted) {
          return;
        }

        setActivityData(buildWeeklyRideCounts(rides));
      } catch {
        if (isMounted) {
          setActivityData(emptyWeeklyActivity);
        }
      } finally {
        if (isMounted) {
          setIsActivityLoading(false);
        }
      }
    };

    void loadActivity();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-title font-extrabold tracking-tight sm:text-headline">{greeting}, {firstName}.</h2>
          <p className="mt-1 text-sm text-muted">{hasChildren ? 'Where is the next ride going?' : 'Add a child to book your first ride.'}</p>
        </div>
        <Button onClick={() => navigate(primaryActionPath)} className="sm:w-auto sm:px-8">
          {hasChildren ? <Car size={18} /> : <Plus size={18} />}
          {hasChildren ? 'Book a ride' : 'Add a child'}
        </Button>
      </section>

      {activeRide && (
        <Card onClick={() => navigate(`/tracking/${activeRide.id}`)} className="border-brand/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <StatusChip status={activeRide.status} />
                {activeRide.tripCode && <span className="text-xs font-semibold text-muted">Trip code {activeRide.tripCode}</span>}
              </div>
              <p className="mt-3 text-lead font-bold">Ride in progress</p>
              <p className="mt-1 truncate text-sm text-muted">
                {activeRide.pickupLocation} <ArrowRight size={14} className="mx-1 inline" /> {activeRide.dropoffLocation}
              </p>
            </div>
            <Button className="sm:w-auto">Track live</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <ParentUpcomingRides />

          <Card>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <h3 className="text-lead font-bold">Your children</h3>
              <Button variant="secondary" onClick={() => navigate('/add-child')} className="sm:w-auto">
                <Plus size={16} />
                Add Child
              </Button>
            </div>

            {hasChildren ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {availableChildren.map((child) => (
                  <div key={child.id} className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                    <div className="flex items-center gap-4">
                      {child.photoUrl ? (
                        <img
                          src={child.photoUrl}
                          alt={child.name}
                          className="h-16 w-16 rounded-[22px] object-cover shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand/10 text-lg font-semibold text-brand-deep shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                          {childInitials(child.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold text-slate-950">{child.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{child.age} years old</p>
                      </div>
                    </div>
                    {child.notes && (
                      <p className="mt-4 rounded-[18px] bg-white px-4 py-3 text-sm leading-6 text-slate-500">
                        {child.notes}
                      </p>
                    )}
                    <button type="button" onClick={() => navigate(`/edit-child/${child.id}`)} className="mt-3 w-full rounded-full border border-slate-200 bg-white py-2 text-sm font-semibold text-brand-deep hover:bg-brand/10">Edit profile</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[26px] border border-dashed border-slate-300 bg-slate-50/90 p-6 text-center">
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand/10 text-brand-deep">
                  <Plus size={24} />
                </div>
                <h4 className="mt-4 text-xl font-bold text-slate-950">Create your first child profile</h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">
                  You need at least one real child profile before you can request a trip, view child-specific safety notes, or coordinate recurring rides.
                </p>
                <Button onClick={() => navigate('/add-child')} className="mt-5 sm:w-auto">
                  Add Child Profile
                </Button>
              </div>
            )}
          </Card>

        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lead font-bold">This week</h3>

            {isActivityLoading ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-center text-sm text-slate-500">
                Loading ride activity...
              </div>
            ) : !hasRecordedActivity ? (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-12 text-center">
                <p className="text-base font-semibold text-slate-950">No ride activity recorded this week</p>
                <p className="mt-2 text-sm text-slate-500">Booked and completed rides will start filling this chart automatically.</p>
              </div>
            ) : (
              <div className="mt-6 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="colorRides" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1d6fff" stopOpacity={0.42} />
                        <stop offset="95%" stopColor="#1d6fff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip contentStyle={{ borderRadius: '18px', border: '1px solid rgba(226,232,240,0.9)', boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }} />
                    <Area type="monotone" dataKey="rides" stroke="#1d6fff" strokeWidth={3} fillOpacity={1} fill="url(#colorRides)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lead font-bold">Safety</h3>
              <ShieldCheck size={20} className="text-brand-deep" />
            </div>
            <p className="mt-2 text-sm text-muted">Every driver is identity-checked and reviewed before their first ride. Trip codes confirm the right child meets the right driver.</p>
            <button type="button" onClick={() => navigate('/safety')} className="mt-3 text-sm font-semibold text-brand-deep">Safety tools</button>
          </Card>
        </div>
      </div>
    </div>
  );
};
