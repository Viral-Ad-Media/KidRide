import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/UIComponents';
import { ShieldCheck, ChevronRight, ArrowLeft, Mail, Bell, MessageSquare, CreditCard, Plus, UserPlus, Share2, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(false);

  const Toggle = ({ value, onChange }: { value: boolean, onChange: (v: boolean) => void }) => (
    <div 
      className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${value ? 'bg-[#3A77FF]' : 'bg-gray-300'}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!value);
      }}
    >
      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-900">Notification Settings</h2>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Mail size={20}/></div>
                    <span className="font-medium text-gray-900">Email Notifications</span>
                </div>
                <Toggle value={email} onChange={setEmail} />
            </div>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Bell size={20}/></div>
                    <span className="font-medium text-gray-900">Push Notifications</span>
                </div>
                <Toggle value={push} onChange={setPush} />
            </div>
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><MessageSquare size={20}/></div>
                    <span className="font-medium text-gray-900">SMS Notifications</span>
                </div>
                <Toggle value={sms} onChange={setSms} />
            </div>
        </div>
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
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#3A77FF]">
                    <CreditCard size={24} />
                </div>
                <h3 className="mt-4 font-bold text-gray-900">No payment methods saved</h3>
                <p className="mt-2 text-sm text-gray-500">
                    Payment methods have not been added to this account yet.
                </p>
             </div>

             <div className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-medium flex items-center justify-center gap-2">
                <Plus size={20} /> Payment method management is not available yet
             </div>
        </div>
     </div>
  );
};

export const Profile = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
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
                alert("Link copied to clipboard: " + shareData.url);
            }
        } catch (err) {
            console.log('Share dismissed', err);
        }
    };

    return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
        
        {/* User Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                {user?.photoUrl ? <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" /> : <span className="text-[#3A77FF] font-bold text-xl">{userInitials(user?.name)}</span>}
            </div>
            <div>
                <h3 className="font-bold text-lg">{user?.name}</h3>
                <p className="text-gray-500 text-sm">{user?.email}</p>
            </div>
        </div>

        {/* Verification Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-2 mb-4">
                 <div className="p-2 bg-blue-50 rounded-lg text-[#3A77FF]">
                    <ShieldCheck size={24} /> 
                 </div>
                 <h3 className="font-bold text-lg">Driver Verification</h3>
             </div>

             {user?.driverApplicationStatus === 'pending' ? (
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
        <div className="bg-gradient-to-r from-purple-500 to-[#6C63FF] p-6 rounded-2xl shadow-sm text-white relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <UserPlus size={24} />
                    <h3 className="font-bold text-lg">Refer a Driver</h3>
                </div>
                <p className="text-white/90 text-sm mb-4">
                    Know someone trustworthy? Invite a spouse, nanny, or friend to create a driver profile.
                </p>
                <button 
                    onClick={handleShare}
                    className="bg-white text-purple-600 px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-opacity-90 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                    <Share2 size={16} /> Share Invite Link
                </button>
             </div>
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full transform translate-x-10 -translate-y-10"></div>
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
