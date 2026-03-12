import React, { createContext, useContext, useEffect, useState } from 'react';
import { Child, User, UserRole } from '../types';
import {
  apiRequest,
  clearStoredToken,
  getStoredToken,
  mapChild,
  mapUser,
  setStoredToken
} from '../services/api';

const USER_STORAGE_KEY = 'kidride_user';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name: string;
  role?: UserRole;
}

interface DriverApplicationPayload {
  phone?: string;
  vehicle?: {
    make?: string;
    model?: string;
    year?: string;
    color?: string;
    plate?: string;
  };
  make?: string;
  model?: string;
  year?: string;
  color?: string;
  plate?: string;
}

interface AuthContextType {
  user: User | null;
  isHydrating: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  submitDriverApplication: (payload?: DriverApplicationPayload) => Promise<void>;
  addChild: (child: Child) => Promise<void>;
}

type AuthResponse = Record<string, unknown> & { token?: string };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const readStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return mapUser(JSON.parse(rawUser));
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

export const getDefaultRouteForUser = (user: User): string => {
  if (user.role === UserRole.DRIVER) {
    if (user.driverApplicationStatus === 'none' || user.driverApplicationStatus === 'rejected') {
      return '/driver-signup';
    }

    return '/driver-dashboard';
  }

  return '/dashboard';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const persistUser = (nextUser: User, token?: string | null) => {
    setUser(nextUser);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    }

    if (token === null) {
      clearStoredToken();
      return;
    }

    if (token) {
      setStoredToken(token);
    }
  };

  const clearSession = () => {
    setUser(null);

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }

    clearStoredToken();
  };

  const finalizeAuthentication = (response: AuthResponse): User => {
    const token = typeof response.token === 'string' ? response.token : null;
    if (!token) {
      throw new Error('Authentication response did not include a token.');
    }

    const mappedUser = mapUser(response);
    persistUser(mappedUser, token);
    return mappedUser;
  };

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      clearSession();
      setIsHydrating(false);
      return;
    }

    const storedUser = readStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }

    let isMounted = true;

    const hydrateUser = async () => {
      try {
        const me = await apiRequest<Record<string, unknown>>('/auth/me', { token });
        if (!isMounted) {
          return;
        }

        persistUser(mapUser(me), token);
      } catch {
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setIsHydrating(false);
        }
      }
    };

    void hydrateUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async ({ email, password }: LoginPayload) => {
    const authResult = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: {
        email: normalizeEmail(email),
        password
      }
    });

    return finalizeAuthentication(authResult);
  };

  const register = async ({ name, email, password, role = UserRole.PARENT }: RegisterPayload) => {
    const authResult = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: {
        name: name.trim(),
        email: normalizeEmail(email),
        password,
        role
      }
    });

    return finalizeAuthentication(authResult);
  };

  const logout = () => {
    clearSession();
  };

  const submitDriverApplication = async (payload?: DriverApplicationPayload) => {
    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to submit a driver application.');
    }

    const currentUser = user ?? readStoredUser();
    const incomingVehicle = payload?.vehicle ?? {
      make: payload?.make,
      model: payload?.model,
      year: payload?.year,
      color: payload?.color,
      plate: payload?.plate
    };

    const response = await apiRequest<{ user?: Record<string, unknown> }>('/users/driver-application', {
      method: 'POST',
      token,
      body: {
        phone: payload?.phone,
        vehicle: incomingVehicle
      }
    });

    const updatedUser = mapUser(response.user || currentUser || {});
    persistUser(updatedUser, token);
  };

  const addChild = async (child: Child) => {
    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to add a child.');
    }

    const currentUser = user ?? readStoredUser();
    if (!currentUser) {
      throw new Error('Unable to resolve the current user. Please log in again.');
    }

    const response = await apiRequest<{ child?: unknown; children?: unknown[] }>('/users/children', {
      method: 'POST',
      token,
      body: {
        name: child.name,
        age: child.age,
        notes: child.notes,
        photoUrl: child.photoUrl
      }
    });

    const nextChildren = Array.isArray(response.children)
      ? response.children.map(mapChild)
      : [...(currentUser.children || []), mapChild(response.child || child)];

    const updatedUser: User = {
      ...currentUser,
      children: nextChildren
    };

    persistUser(updatedUser, token);
  };

  return (
    <AuthContext.Provider value={{ user, isHydrating, login, register, logout, submitDriverApplication, addChild }}>
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
