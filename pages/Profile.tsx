import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/UIComponents';
import { ShieldCheck, ChevronRight, ArrowLeft, Mail, Bell, MessageSquare, CreditCard, UserPlus, Share2, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { DriverApplicationStatus } from '../components/DriverApplicationStatus';
import { DriverReviews } from '../components/Ratings';

// Name and phone are editable here; vehicle details are part of the verified
// driver application, so changing them means re-applying.
const AccountDetails = () => {
    const { user, updateProfile } = useAuth();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    if (!user) return null;
    const vehicle = user.vehicle;
    const vehicleText = vehicle && [vehicle.color, vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');

    const startEditing = () => { setName(user.name); setPhone(user.phone || ''); setError(null); setEditing(true); };
    const save = async () => {
        if (!name.trim()) { setError('Name cannot be empty.'); return; }
        setSaving(true); setError(null);
        try { await updateProfile({ name: name.trim(), phone: phone.trim() }); setEditing(false); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not save your details.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Account details</h3>
                {!editing && <button type="button" onClick={startEditing} className="text-sm font-semibold text-brand-deep hover:underline">Edit</button>}
            </div>
            {editing ? (
                <div className="space-y-4">
                    <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" autoComplete="tel" />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-3">
                        <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                        <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                    </div>
                </div>
            ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div><dt className="text-gray-500">Name</dt><dd className="font-medium text-gray-900">{user.name}</dd></div>
                    <div><dt className="text-gray-500">Phone</dt><dd className="font-medium text-gray-900">{user.phone || 'Not added'}</dd></div>
                    {user.role === UserRole.DRIVER && (
                        <div className="sm:col-span-2">
                            <dt className="text-gray-500">Vehicle</dt>
                            <dd className="font-medium text-gray-900">{vehicleText ? `${vehicleText}${vehicle?.plate ? ` (${vehicle.plate})` : ''}` : 'Not provided'}</dd>
                            <p className="mt-1 text-xs text-gray-400">Vehicle changes need a new driver application so they can be re-verified.</p>
                        </div>
                    )}
                </dl>
            )}
        </div>
    );
};

const userInitials = (name: string | undefined) => (
  name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'KR'
);

export const NotificationSettings = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [email, setEmail] = useState(user?.notifyEmail !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEmail = async () => {
    const next = !email;
    setEmail(next);
    setSaving(true);
    setError(null);
    try { await updateProfile({ notifyEmail: next }); } catch (err) { setEmail(!next); setError(err instanceof Error ? err.message : 'Could not save.'); } finally { setSaving(false); }
  };

  const Toggle = ({ value, onChange, disabled = false }: { value: boolean; onChange?: () => void; disabled?: boolean }) => (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={onChange}
      className={`h-7 w-12 rounded-full p-1 transition-colors ${value ? 'bg-success' : 'bg-line'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  const Row = ({ icon, label, note, children }: { icon: React.ReactNode; label: string; note: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-deep">{icon}</span>
        <span className="min-w-0">
          <span className="block font-semibold">{label}</span>
          <span className="block text-sm text-muted">{note}</span>
        </span>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep">
            <ArrowLeft size={18} /> Back
        </button>

        <p className="text-sm text-muted">Ride updates always appear in your inbox in the app. Choose where else KidRide reaches you.</p>

        <div className="divide-y divide-line rounded-card border border-line bg-white">
            <Row icon={<Mail size={20} />} label="Email" note={saving ? 'Saving...' : `Ride updates to ${user?.email || 'your email'}`}>
                <Toggle value={email} onChange={toggleEmail} disabled={saving} />
            </Row>
            <Row icon={<Bell size={20} />} label="Push" note="Needs the KidRide phone app, not available yet">
                <Toggle value={false} disabled />
            </Row>
            <Row icon={<MessageSquare size={20} />} label="SMS" note="Not available yet">
                <Toggle value={false} disabled />
            </Row>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
};

export const PaymentMethods = () => {
  const navigate = useNavigate();
  return (
     <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-900">Payment Methods</h2>
        </div>

        <div className="space-y-4">
             <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand-deep">
                    <CreditCard size={24} />
                </div>
                <span className="mt-4 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-deep">Coming soon</span>
                <h3 className="mt-3 font-bold text-gray-900">Card payments are on the way</h3>
                <p className="mt-2 text-sm text-gray-500">
                    You will be able to save a card and pay for rides here. Until then, there is nothing to set up and rides are not charged in the app.
                </p>
             </div>
        </div>
     </div>
  );
};

export const Profile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [shareNote, setShareNote] = useState<string | null>(null);

    const handleStartVerification = () => {
        navigate('/driver-signup');
    };

    const handleShare = async () => {
        const shareData = {
            title: 'Drive with KidRide',
            text: 'Join KidRide as a driver and earn money helping families! Check it out here:',
            url: window.location.origin + '/#/drive'
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                setShareNote('Invite link copied to your clipboard.');
            }
        } catch (err) {
            console.log('Share dismissed', err);
        }
    };

    return (
    <div className="space-y-6">
        {/* User Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-16 h-16 bg-brand/15 rounded-full flex items-center justify-center overflow-hidden">
                {user?.photoUrl ? <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-brand-deep font-bold text-xl">{userInitials(user?.name)}</span>}
            </div>
            <div>
                <h3 className="font-bold text-lg">{user?.name}</h3>
                <p className="text-gray-500 text-sm">{user?.email}</p>
            </div>
        </div>

        <AccountDetails />

        {user?.role === UserRole.DRIVER && user.driverApplicationStatus === 'approved' && <DriverReviews driverId={user.id} />}

        {/* Verification Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-2 mb-4">
                 <div className="p-2 bg-brand/10 rounded-lg text-brand-deep">
                    <ShieldCheck size={24} /> 
                 </div>
                 <h3 className="font-bold text-lg">Driver Verification</h3>
             </div>

             {user?.role === UserRole.DRIVER ? (
                 <>
                    <DriverApplicationStatus />
                    {user.driverApplicationStatus !== 'approved' && user.driverApplicationStatus !== 'pending' && (
                        <Button fullWidth className="mt-4" onClick={handleStartVerification}>{user.driverApplicationStatus === 'rejected' ? 'Apply again' : 'Start Verification'}</Button>
                    )}
                 </>
             ) : user?.driverApplicationStatus === 'pending' ? (
                 <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                    <Clock className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-bold text-yellow-800">Application Pending</p>
                        <p className="text-xs text-yellow-700 mt-1">We are currently reviewing your documents and background check. You'll be notified soon.</p>
                    </div>
                 </div>
             ) : user?.driverApplicationStatus === 'approved' ? (
                 <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="font-bold text-green-800">Verified Driver</p>
                        <p className="text-xs text-green-700 mt-1">You are fully verified and ready to drive!</p>
                    </div>
                 </div>
             ) : (
                <>
                    <p className="text-gray-600 text-sm mb-6">
                        Become a verified Parent Driver to help your team and earn money for carpooling.
                    </p>
                    <div className="space-y-4 mb-6">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center"></div>
                            <span>Upload Driver's License</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center"></div>
                            <span>Vehicle Insurance</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center"></div>
                            <span>Background Check Consent</span>
                        </div>
                    </div>
                    <Button fullWidth onClick={handleStartVerification}>Start Verification</Button>
                </>
             )}
        </div>

        {/* Refer a Driver Section */}
        <div className="rounded-card border border-line bg-white p-5">
             <div>
                <div className="flex items-center gap-2">
                    <UserPlus size={20} className="text-brand-deep" />
                    <h3 className="text-lead font-bold">Refer a driver</h3>
                </div>
                <p className="mt-2 text-sm text-muted">
                    Know someone trustworthy? Invite a spouse, nanny or friend to create a driver profile.
                </p>
                <button
                    onClick={handleShare}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-deep"
                >
                    <Share2 size={16} /> Share invite link
                </button>
                {shareNote && <p className="mt-3 text-sm text-muted">{shareNote}</p>}
             </div>
        </div>

        {/* Settings Links */}
        <div className="space-y-3">
            <div 
                role="button"
                tabIndex={0}
                onClick={() => navigate('/profile/notifications')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center active:bg-gray-100"
            >
                <span className="font-medium text-gray-700">Notification Settings</span>
                <ChevronRight size={20} className="text-gray-400" />
            </div>
            
            <div 
                role="button"
                tabIndex={0}
                onClick={() => navigate('/profile/payments')}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors flex justify-between items-center active:bg-gray-100"
            >
                <span className="font-medium text-gray-700">Payment Methods</span>
                <ChevronRight size={20} className="text-gray-400" />
            </div>
        </div>
    </div>
    );
};
