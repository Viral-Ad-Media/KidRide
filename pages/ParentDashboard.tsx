import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { ArrowRight, Calendar, Car, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { Badge, Button, Card, StatusChip } from '../components/UIComponents';
import { MOCK_CARPOOLS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useRide } from '../contexts/RideContext';

const data = [
  { name: 'Mon', rides: 2 },
  { name: 'Tue', rides: 1 },
  { name: 'Wed', rides: 3 },
  { name: 'Thu', rides: 2 },
  { name: 'Fri', rides: 4 },
  { name: 'Sat', rides: 5 },
  { name: 'Sun', rides: 2 }
];

export const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeRide } = useRide();
  const availableChildren = user?.children || [];
  const hasChildren = availableChildren.length > 0;
  const primaryActionPath = hasChildren ? '/book' : '/add-child';

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,#0f3ea8_0%,#1d6fff_58%,#8ecbff_100%)] p-6 text-white shadow-[0_28px_70px_rgba(29,111,255,0.25)] sm:p-8">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100/88">Parent Workspace</p>
            <h2 className="mt-3 text-4xl font-bold text-balance sm:text-5xl">
              Good morning, {user?.name.split(' ')[0] || 'Parent'}.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/78 sm:text-base">
              Keep child profiles, ride activity, and quick actions in one place with a layout that works just as well on a laptop as it does on your phone.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
            <Button onClick={() => navigate(primaryActionPath)} className="bg-white text-slate-950 hover:bg-slate-100">
              {hasChildren ? 'Book a Ride' : 'Add a Child'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/profile')} className="border-white/30 bg-white/10 text-white hover:bg-white/16">
              Open Profile
            </Button>
          </div>
        </div>

        {activeRide && (
          <div className="mt-8 grid gap-4 rounded-[28px] border border-white/15 bg-white/10 p-5 backdrop-blur-xl lg:grid-cols-[1fr,auto] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusChip status={activeRide.status} />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Trip Code {activeRide.tripCode}</span>
              </div>
              <p className="mt-4 text-xl font-bold text-white">Live ride in progress</p>
              <p className="mt-2 text-sm text-white/75">
                {activeRide.pickupLocation} <ArrowRight size={14} className="mx-1 inline" /> {activeRide.dropoffLocation}
              </p>
            </div>
            <Button onClick={() => navigate(`/tracking/${activeRide.id}`)} className="bg-slate-950 text-white hover:bg-slate-900">
              Track Live Ride
            </Button>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Child Profiles</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">Who needs a ride today?</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Every ride now starts from a real child profile saved to your account.
                </p>
              </div>
              <Button variant="secondary" onClick={() => navigate('/add-child')} className="sm:w-auto">
                <Plus size={16} />
                Add Child
              </Button>
            </div>

            {hasChildren ? (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {availableChildren.map((child) => (
                  <div key={child.id} className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={child.photoUrl}
                        alt={child.name}
                        className="h-16 w-16 rounded-[22px] object-cover shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
                      />
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{child.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{child.age} years old</p>
                      </div>
                    </div>
                    {child.notes && (
                      <p className="mt-4 rounded-[18px] bg-white px-4 py-3 text-sm leading-6 text-slate-500">
                        {child.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-[26px] border border-dashed border-slate-300 bg-slate-50/90 p-6 text-center">
                <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-blue-50 text-[#1d6fff]">
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

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Community</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">Suggested Carpools</h3>
              </div>
              <button onClick={() => navigate('/carpools')} className="text-sm font-semibold text-[#1d6fff]">
                See All
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {MOCK_CARPOOLS.slice(0, 2).map((offer) => (
                <Card key={offer.id} className="bg-slate-50/90" onClick={() => navigate('/carpools')}>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-4">
                        <img src={offer.parentPhoto} alt={offer.parentName} className="h-14 w-14 rounded-[20px] object-cover" />
                        <div>
                          <p className="font-semibold text-slate-950">{offer.parentName}</p>
                          <p className="mt-1 text-sm text-slate-500">Going to {offer.eventName}</p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-slate-600">
                        {offer.fromLocation} <ArrowRight size={14} className="mx-1 inline" /> {offer.toLocation}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">{offer.departureTime}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
                      <Badge type="team" />
                      <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{offer.seatsAvailable} seats left</p>
                        <p className="mt-2 text-xl font-bold text-[#1d6fff]">${offer.pricePerSeat}/seat</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Activity</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">Ride activity this week</h3>
            <div className="mt-6 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
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
          </Card>

          <Card className="overflow-hidden bg-[linear-gradient(145deg,#fff7ed_0%,#ffffff_58%,#eff6ff_100%)]">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-[18px] bg-white text-[#1d6fff] shadow-[0_12px_24px_rgba(29,111,255,0.12)]">
              <ShieldCheck size={22} />
            </div>
            <h3 className="mt-5 text-2xl font-bold text-slate-950">Ready to verify as a parent driver?</h3>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Complete verification once and unlock a stronger trust signal for families who know you personally.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Perk</p>
                <p className="mt-2 font-semibold text-slate-950">Visible trust badge</p>
              </div>
              <div className="rounded-[22px] bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Flow</p>
                <p className="mt-2 font-semibold text-slate-950">Application + review</p>
              </div>
            </div>
            <Button onClick={() => navigate('/profile')} className="mt-6">
              <Sparkles size={16} />
              Open Verification
            </Button>
          </Card>

          <Card className="bg-slate-950 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/88">Planning</p>
            <h3 className="mt-2 text-2xl font-bold">Keep the next ride one tap away.</h3>
            <p className="mt-3 text-sm leading-7 text-white/68">
              Use saved child profiles and live ride history to move faster during school pickups, activities, and last-minute schedule changes.
            </p>
            <Button onClick={() => navigate(primaryActionPath)} className="mt-6 bg-white text-slate-950 hover:bg-slate-100">
              {hasChildren ? 'Book the Next Ride' : 'Create First Child'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
