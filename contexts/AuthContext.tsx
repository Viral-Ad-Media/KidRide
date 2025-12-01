import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  login: (role: UserRole) => void;
  logout: () => void;
  submitDriverApplication: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Initialize with a mock user
  useEffect(() => {
    const storedUser = localStorage.getItem('kidride_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
        // Default demo user
        const defaultUser: User = {
            id: 'u1',
            name: 'Alex Johnson',
            role: UserRole.PARENT,
            email: 'alex.johnson@example.com',
            photoUrl: 'https://ui-avatars.com/api/?name=Alex+Johnson&background=0D8ABC&color=fff',
            driverApplicationStatus: 'none'
        };
        setUser(defaultUser);
    }
  }, []);

  const login = (role: UserRole) => {
     // Mock login logic
     const newUser: User = {
        id: 'u1',
        name: role === UserRole.DRIVER ? 'Sarah Jenkins' : 'Alex Johnson',
        role: role,
        email: 'test@example.com',
        driverApplicationStatus: 'none',
        photoUrl: `https://ui-avatars.com/api/?name=${role === UserRole.DRIVER ? 'Sarah+Jenkins' : 'Alex+Johnson'}&background=random&color=fff`
     };
     setUser(newUser);
     localStorage.setItem('kidride_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('kidride_user');
  };

  const submitDriverApplication = () => {
    if (user) {
        const updatedUser: User = { ...user, driverApplicationStatus: 'pending' };
        setUser(updatedUser);
        localStorage.setItem('kidride_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, submitDriverApplication }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};