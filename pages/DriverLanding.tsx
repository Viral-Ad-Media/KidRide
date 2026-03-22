
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/UIComponents';
import { CheckCircle, DollarSign, Clock, Shield, ArrowRight, ArrowLeft } from 'lucide-react';

export const DriverLanding = () => {
  const navigate = useNavigate();
  const publicLinks = [
    { path: '/about', label: 'About' },
    { path: '/help', label: 'Help' },
    { path: '/contact', label: 'Contact' },
    { path: '/privacy', label: 'Privacy' },
    { path: '/terms', label: 'Terms' }
  ];

  return (
    <div className="bg-white min-h-screen pb-24">
      {/* Header Image Area */}
      <div className="relative h-64 bg-[#3A77FF] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent z-10"></div>
        <img 
            src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop" 
            alt="Driving" 
            className="w-full h-full object-cover opacity-80"
        />
        <button 
            onClick={() => navigate('/')} 
            className="absolute top-6 left-6 z-20 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/30 transition-colors"
        >
            <ArrowLeft size={24} />
        </button>
        <div className="absolute bottom-6 left-6 right-6 z-20 text-white">
            <h1 className="text-3xl font-bold mb-2">Drive with KidRide</h1>
            <p className="font-medium text-white/90">Earn money on your schedule helping busy families.</p>
        </div>
      </div>

      <div className="p-6 space-y-8 animate-fade-in">
        
        {/* Value Props */}
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-[#3A77FF] mb-3 shadow-sm">
                    <DollarSign size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Good Earnings</h3>
                <p className="text-xs text-gray-500 mt-1">Earn more with specialized care rides.</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center text-purple-600 mb-3 shadow-sm">
                    <Clock size={20} />
                </div>
                <h3 className="font-bold text-gray-900">Flexible Hours</h3>
                <p className="text-xs text-gray-500 mt-1">Drive when you want, as much as you want.</p>
            </div>
        </div>

        {/* Requirements */}
        <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Requirements</h2>
            <Card className="space-y-4">
                <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 shrink-0" size={20} />
                    <span className="text-gray-700">At least 21 years of age</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 shrink-0" size={20} />
                    <span className="text-gray-700">Valid driver's license (3+ years)</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 shrink-0" size={20} />
                    <span className="text-gray-700">4-door vehicle (2010 or newer)</span>
                </div>
                <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 shrink-0" size={20} />
                    <span className="text-gray-700">Pass a background check</span>
                </div>
            </Card>
        </div>

        {/* Safety First */}
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl">
            <Shield className="text-[#3A77FF] shrink-0 mt-1" size={24} />
            <div>
                <h3 className="font-bold text-gray-900">Safety First Community</h3>
                <p className="text-sm text-gray-600 mt-1">
                    We verify every parent and driver and keep safety guidance visible throughout the product.
                </p>
            </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-gray-900">Before you apply</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                {publicLinks.map((link) => (
                    <Link key={link.path} to={link.path} className="transition hover:text-gray-900">
                        {link.label}
                    </Link>
                ))}
            </div>
        </div>

      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 md:relative md:border-none md:p-0">
         <div className="max-w-md mx-auto space-y-3">
            <Button fullWidth onClick={() => navigate('/driver-signup')} className="flex items-center justify-center gap-2">
                Start Application <ArrowRight size={20} />
            </Button>
            <Button fullWidth variant="secondary" onClick={() => navigate('/')}>
                Already have an account? Log In
            </Button>
         </div>
      </div>
    </div>
  );
};
