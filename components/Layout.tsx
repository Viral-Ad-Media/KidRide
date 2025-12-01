import React, { useState } from 'react';
import { Home, Car, MessageCircle, User, Menu, X, Shield, CreditCard, HelpCircle, LogOut, Briefcase, DollarSign, Map } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAuthPage = location.pathname === '/' || location.pathname === '/drive' || location.pathname === '/driver-signup';
  
  if (isAuthPage) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  const parentNavItems = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Car, label: 'Rides', path: '/rides' },
    { icon: MessageCircle, label: 'Safety', path: '/safety' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const driverNavItems = [
    { icon: Briefcase, label: 'Jobs', path: '/driver-dashboard' },
    { icon: Map, label: 'Map', path: '/driver-map' }, // Placeholder path
    { icon: DollarSign, label: 'Earnings', path: '/earnings' }, // Placeholder
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  const navItems = user?.role === UserRole.DRIVER ? driverNavItems : parentNavItems;

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] pb-24 md:pb-0 relative">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-2xl relative">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div onClick={() => navigate(user?.role === UserRole.DRIVER ? '/driver-dashboard' : '/dashboard')} className="cursor-pointer">
              <h1 className="text-xl font-bold text-[#3A77FF]">KidRide</h1>
            </div>
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Open menu"
            >
                <Menu size={24} className="text-gray-700" />
            </button>
        </header>

        {/* Content */}
        <main className="p-6">
          {children}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-6 flex justify-around items-center z-30 md:max-w-md md:mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button 
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 ${isActive ? 'text-[#3A77FF]' : 'text-gray-400'}`}
              >
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Mobile Menu Drawer */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-50 flex justify-end md:absolute md:max-w-md md:left-auto md:right-0">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMenuOpen(false)}
            />
            
            {/* Drawer Content */}
            <div className="relative w-3/4 max-w-xs bg-white h-full shadow-2xl p-6 flex flex-col transform transition-transform duration-300 ease-in-out">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-2xl font-bold text-[#3A77FF]">Menu</h2>
                 <button 
                   onClick={() => setIsMenuOpen(false)} 
                   className="p-2 hover:bg-gray-100 rounded-full"
                 >
                   <X size={24} className="text-gray-500" />
                 </button>
              </div>
              
              <div className="flex items-center gap-4 mb-8 p-3 bg-blue-50 rounded-xl">
                 <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center text-blue-600 overflow-hidden">
                    {user?.photoUrl ? <img src={user.photoUrl} alt="User" /> : 'U'}
                 </div>
                 <div>
                    <p className="font-bold text-gray-900 line-clamp-1">{user?.name || 'Guest'}</p>
                    <p className="text-xs text-blue-600">{user?.role === UserRole.DRIVER ? 'Driver Account' : 'Parent Account'}</p>
                 </div>
              </div>
              
              <div className="space-y-2 flex-1">
                 <button onClick={() => handleNavigation('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                    <User size={20} className="text-gray-400" /> Profile & Settings
                 </button>
                 <button onClick={() => handleNavigation('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                    <Shield size={20} className="text-gray-400" /> Verification Status
                 </button>
                 <button onClick={() => handleNavigation('/profile/payments')} className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                    <CreditCard size={20} className="text-gray-400" /> Payments
                 </button>
                 
                 {user?.role === UserRole.PARENT && (
                    <>
                        <div className="my-2 border-t border-gray-100"></div>
                        <button onClick={() => handleNavigation('/drive')} className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-gray-50 text-gray-900 font-bold transition-colors">
                            <Briefcase size={20} className="text-[#3A77FF]" /> Drive with KidRide
                        </button>
                    </>
                 )}

                 <div className="my-2 border-t border-gray-100"></div>
                 <button onClick={() => handleNavigation('/safety')} className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors">
                    <HelpCircle size={20} className="text-gray-400" /> Help & Support
                 </button>
              </div>

              <button 
                onClick={handleLogout} 
                className="flex items-center gap-4 w-full p-3 rounded-xl hover:bg-red-50 text-red-500 font-medium mt-4 transition-colors"
              >
                <LogOut size={20} /> Log Out
             </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};