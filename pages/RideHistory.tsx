import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RepeatingRides } from '../components/RepeatingRides';
import { UpcomingRideActions } from '../components/UpcomingRides';
import { useRide } from '../contexts/RideContext';
import { Button, Card, Modal, StatusChip } from '../components/UIComponents';
import { fetchUserRides, getStoredToken } from '../services/api';
import { Ride, RideStatus } from '../types';
import { RateRideModal, Stars } from '../components/Ratings';
import { ArrowRight, Calendar, Car, ChevronRight, Clock, MapPin, Repeat } from 'lucide-react';
import { formatMoney, formatPickupTime, formatRidePrice } from '../utils/rideData';
import { RidePaymentStatus } from '../components/payments/RidePaymentStatus';
import { FareBreakdown } from '../components/FareBreakdown';

const childNames = (ride: Ride) => (ride.children || []).map((child) => child.name.split(' ')[0]).filter(Boolean).join(', ');

// A printable receipt for a finished or cancelled ride (the browser's Print saves it as a PDF).
const ReceiptModal: React.FC<{ ride: Ride | null; onClose: () => void }> = ({ ride, onClose }) => (
  <Modal open={!!ride} onClose={onClose} labelledBy="receipt-title">
    {ride && (
      <div className="kr-receipt text-sm text-ink">
        <h2 id="receipt-title" className="text-lg font-bold">KidRide receipt</h2>
        <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
          <dt className="text-muted">Ride</dt><dd className="font-mono text-xs">{ride.id.slice(0, 8).toUpperCase()}</dd>
          <dt className="text-muted">Date</dt><dd>{formatPickupTime(ride.pickupTime)}</dd>
          {childNames(ride) && (<><dt className="text-muted">Children</dt><dd>{childNames(ride)}</dd></>)}
          <dt className="text-muted">From</dt><dd>{ride.pickupLocation}</dd>
          <dt className="text-muted">To</dt><dd>{ride.dropoffLocation}</dd>
          <dt className="text-muted">Service</dt><dd className="capitalize">{ride.serviceType.replace(/_/g, ' ')}</dd>
          {ride.driver?.name && (<><dt className="text-muted">Driver</dt><dd>{ride.driver.name}</dd></>)}
          <dt className="text-muted">Status</dt><dd className="capitalize">{String(ride.status).replace(/_/g, ' ')}</dd>
        </dl>
        <div className="mt-4 border-t border-line pt-3">
          {ride.status === RideStatus.CANCELLED
            ? <p className="flex justify-between font-bold"><span>Cancellation fee</span><span>{ride.cancellationFee ? formatMoney(ride.cancellationFee, ride.currency) : formatMoney(0, ride.currency)}</span></p>
            : ride.fare ? <FareBreakdown fare={ride.fare} currency={ride.currency} /> : <p className="flex justify-between font-bold"><span>Total</span><span>{formatRidePrice(ride.price, undefined, ride.currency)}</span></p>}
        </div>
        {ride.payment?.status === 'succeeded' && (
          <p className="mt-2 flex justify-between text-xs text-muted"><span>Paid by card</span><span>{formatMoney(ride.payment.amountCharged, ride.currency)}{ride.payment.amountRefunded > 0 ? `, ${formatMoney(ride.payment.amountRefunded, ride.currency)} refunded` : ''}</span></p>
        )}
        <p className="mt-4 text-xs text-muted">KidRide. Keep this receipt for your records.</p>
        <div className="mt-6 flex justify-end gap-2 print:hidden">
          <button type="button" onClick={onClose} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Close</button>
          <button type="button" onClick={() => window.print()} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-ink">Print or save PDF</button>
        </div>
      </div>
    )}
  </Modal>
);

const FareDetails: React.FC<{ ride: Ride }> = ({ ride }) => (
  <details className="mt-2 text-xs text-gray-600">
    <summary className="cursor-pointer font-semibold text-brand-deep">Fare details</summary>
    <FareBreakdown fare={ride.fare!} currency={ride.currency} className="mt-2" />
  </details>
);

export const RideHistory = () => {
  const navigate = useNavigate();
  const { activeRide } = useRide();
  const [params] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'past'>(() => (params.get('tab') === 'upcoming' ? 'upcoming' : params.get('tab') === 'past' ? 'past' : 'active'));
  // Bumped when a repeating booking changes (or books its next week) so the list reloads.
  const [reloadKey, setReloadKey] = useState(0);
  const [upcomingRides, setUpcomingRides] = useState<Ride[]>([]);
  const [pastRides, setPastRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ?rate=<rideId> (from the "arrived" alert or the tracking screen) opens the rating sheet.
  const [ratingRideId, setRatingRideId] = useState<string | null>(() => params.get('rate'));
  const [receiptRide, setReceiptRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (activeTab === 'active') {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setError('Sign in to view your ride history.');
      return;
    }

    let isMounted = true;
    const scope = activeTab === 'upcoming' ? 'upcoming' : 'past';

    const loadRides = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const mappedRides = await fetchUserRides(scope, token, 20);
        if (!isMounted) {
          return;
        }

        if (scope === 'upcoming') {
          setUpcomingRides(mappedRides);
        } else {
          setPastRides(mappedRides);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load rides right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadRides();

    return () => {
      isMounted = false;
    };
  }, [activeTab, reloadKey]);

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`-mb-px px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
        activeTab === id
          ? 'border-brand-deep text-ink'
          : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between border-b border-line">
        <div className="flex">
          <TabButton id="active" label="Active" />
          <TabButton id="upcoming" label="Upcoming" />
          <TabButton id="past" label="Past" />
        </div>
        <button type="button" onClick={() => navigate('/book')} className="mb-2 hidden text-sm font-semibold text-brand-deep sm:block">+ Book a ride</button>
      </div>

      <div className="space-y-4 animate-fade-in">
        {activeTab === 'active' && (
          <>
            {!activeRide ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-brand/10 text-brand-deep rounded-full flex items-center justify-center mx-auto mb-4">
                  <Car size={32} />
                </div>
                <h3 className="font-bold text-gray-900">No active rides</h3>
                <p className="text-sm text-gray-500 mb-4">You don't have any trips in progress.</p>
                <Button onClick={() => navigate('/book')} className="mx-auto">Book a ride</Button>
              </div>
            ) : (
              <Card onClick={() => navigate(`/tracking/${activeRide.id}`)} className="border-l-4 border-l-green-500">
                <div className="flex justify-between items-center mb-4">
                  <StatusChip status={activeRide.status} />
                  <span className="text-xs font-mono font-bold text-gray-500">CODE: {activeRide.tripCode}</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-brand-deep" />
                    <span className="text-sm font-medium">{activeRide.pickupLocation}</span>
                    <ArrowRight size={12} className="text-gray-400" />
                    <span className="text-sm font-medium">{activeRide.dropoffLocation}</span>
                  </div>
                </div>
                <Button variant="secondary" fullWidth className="h-10 text-sm">Track Live</Button>
              </Card>
            )}
          </>
        )}

        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            <RepeatingRides onChanged={() => setReloadKey((key) => key + 1)} />
            {isLoading ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-500">Loading upcoming rides...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : upcomingRides.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-brand/10 text-brand-deep rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar size={32} />
                </div>
                <h3 className="font-bold text-gray-900">No upcoming rides</h3>
                <p className="text-sm text-gray-500">Future bookings will appear here.</p>
              </div>
            ) : (
              upcomingRides.map((ride) => (
                <Card key={ride.id}>
                  <div className="flex items-center gap-3 mb-3 text-sm text-gray-600">
                    <Calendar size={16} className="text-brand-deep" />
                    <span className="font-semibold text-gray-900">{formatPickupTime(ride.pickupTime)}</span>
                    {ride.seriesId && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-ink"><Repeat size={12} /> Repeats weekly</span>}
                  </div>
                  <div className="pl-7 border-l-2 border-gray-100 space-y-2 mb-4">
                    <p className="text-sm flex items-center gap-2">
                      {ride.pickupLocation} <ArrowRight size={12} /> {ride.dropoffLocation}
                    </p>
                    {childNames(ride) && <p className="text-sm"><span className="text-gray-500">For:</span> <span className="font-medium">{childNames(ride)}</span></p>}
                    <p className="text-sm">
                      <span className="text-gray-500">Service:</span> <span className="font-medium">{ride.serviceType.replace(/_/g, ' ')}</span>
                    </p>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <StatusChip status={ride.status} />
                    <span className="font-bold text-gray-900">{formatRidePrice(ride.price, undefined, ride.currency)}</span>
                  </div>
                  {ride.fare && <FareDetails ride={ride} />}
                  <RidePaymentStatus ride={ride} onChanged={() => setReloadKey((key) => key + 1)} />
                  {[RideStatus.REQUESTED, RideStatus.SEARCHING_DRIVER, RideStatus.DRIVER_ASSIGNED].includes(ride.status) && (
                    <UpcomingRideActions ride={ride} onChanged={() => setReloadKey((key) => key + 1)} />
                  )}
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'past' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-500">Loading ride history...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : pastRides.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-brand/10 text-brand-deep rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock size={32} />
                </div>
                <h3 className="font-bold text-gray-900">No completed rides yet</h3>
                <p className="text-sm text-gray-500">Finished trips will appear here after they wrap up.</p>
              </div>
            ) : (
              pastRides.map((ride) => (
                <Card key={ride.id} className="opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">{formatPickupTime(ride.pickupTime)}</p>
                      <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        {ride.pickupLocation} <ArrowRight size={12} /> {ride.dropoffLocation}
                      </h4>
                    </div>
                    <StatusChip status={ride.status} />
                  </div>
                  {childNames(ride) && <p className="text-xs text-gray-600">For {childNames(ride)}</p>}
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-xs text-gray-600">{ride.serviceType.replace(/_/g, ' ')}</span>
                    <span className="font-bold text-gray-900">{ride.status === RideStatus.CANCELLED ? (ride.cancellationFee ? `${formatMoney(ride.cancellationFee, ride.currency)} fee` : 'No charge') : formatRidePrice(ride.price, undefined, ride.currency)}</span>
                  </div>
                  {ride.fare && ride.status !== RideStatus.CANCELLED && <FareDetails ride={ride} />}
                  <RidePaymentStatus ride={ride} onChanged={() => setReloadKey((key) => key + 1)} />
                  <button type="button" onClick={() => setReceiptRide(ride)} className="mt-2 text-xs font-semibold text-brand-deep underline">View receipt</button>
                  {ride.status === RideStatus.COMPLETED && (
                    <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                      {ride.rating ? (
                        <span className="flex items-center gap-2 text-xs text-gray-500">Your rating <Stars value={ride.rating.stars} /></span>
                      ) : !ride.canRate ? (
                        <span className="text-xs text-gray-500">Rating closed</span>
                      ) : (
                        <>
                          <span className="text-xs text-gray-500">How was your driver?</span>
                          <button type="button" onClick={() => setRatingRideId(ride.id)} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">Rate driver</button>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
            {pastRides.length > 0 && (
              <div className="text-center py-4">
                <button className="text-sm text-gray-500 font-medium flex items-center justify-center gap-1 mx-auto hover:text-brand-deep">
                  Showing latest rides <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <ReceiptModal ride={receiptRide} onClose={() => setReceiptRide(null)} />
      <RateRideModal
        rideId={ratingRideId}
        onClose={() => setRatingRideId(null)}
        onRated={(rideId, rating) => setPastRides((rides) => rides.map((ride) => (ride.id === rideId ? { ...ride, rating, canRate: false } : ride)))}
      />
    </div>
  );
};
