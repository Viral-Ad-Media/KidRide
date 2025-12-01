import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/UIComponents';
import { ShieldCheck, Heart, UserPlus, Car } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export const Welcome = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleParentLogin = () => {
    login(UserRole.PARENT);
    navigate('/dashboard');
  };

  const handleDriverLogin = () => {
    login(UserRole.DRIVER);
    navigate('/driver-dashboard');
  };

  return (
    <div className="flex flex-col h-screen p-8 justify-center items-center bg-gradient-to-br from-[#3A77FF] to-[#6C63FF] text-white">
      <div className="mb-12 text-center">
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-lg">
          <ShieldCheck size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-3">KidRide</h1>
        <p className="text-white/80 text-lg">Safe rides for your most precious cargo.</p>
      </div>

      <div className="w-full space-y-4 max-w-sm">
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 text-center mb-6">
            <p className="text-sm font-medium mb-4 opacity-90">Get Started</p>
            <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={handleParentLogin}
                  className="bg-white text-[#3A77FF] p-4 rounded-xl font-semibold shadow-lg hover:bg-gray-50 transition flex items-center justify-center gap-3"
                >
                    <Heart size={24} className="fill-current" />
                    <span>I'm a Parent</span>
                </button>
                <button 
                    onClick={handleDriverLogin}
                    className="bg-blue-600/50 text-white p-4 rounded-xl font-semibold hover:bg-blue-600/70 transition flex items-center justify-center gap-3"
                >
                    <Car size={24} />
                    <span>Log in as Driver</span>
                </button>
            </div>
        </div>
        
        <div className="text-center">
             <button 
                onClick={() => navigate('/drive')}
                className="text-white/80 text-sm font-medium hover:text-white flex items-center justify-center gap-2 mx-auto"
            >
                <UserPlus size={16} /> New Driver? Apply Here
            </button>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-white/60 text-center">
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
};