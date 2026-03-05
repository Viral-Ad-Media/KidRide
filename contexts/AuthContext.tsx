import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Child } from '../types';
import {
  ApiError,
  apiRequest,
  clearStoredToken,
  getStoredToken,
  mapChild,
  mapUser,
  setStoredToken
} from '../services/api';

const USER_STORAGE_KEY = 'kidride_user';

const DEMO_ACCOUNTS: Record<UserRole, { name: string; email: string; password: string; role: UserRole }> = {
  [UserRole.PARENT]: {
    name: 'Alex Johnson',
    email: 'demo.parent@kidride.app',
    password: 'KidRide123!',
    role: UserRole.PARENT
  },
  [UserRole.DRIVER]: {
    name: 'Sarah Jenkins',
    email: 'demo.driver@kidride.app',
    password: 'KidRide123!',
    role: UserRole.DRIVER
  },
  [UserRole.ADMIN]: {
    name: 'Admin User',
    email: 'demo.admin@kidride.app',
    password: 'KidRide123!',
    role: UserRole.ADMIN
  }
};

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
  login: (role: UserRole) => Promise<void>;
  logout: () => void;
  submitDriverApplication: (payload?: DriverApplicationPayload) => Promise<void>;
  addChild: (child: Child) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const persistUser = (nextUser: User, token?: string | null) => {
    setUser(nextUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));

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
    localStorage.removeItem(USER_STORAGE_KEY);
    clearStoredToken();
  };

  type AuthResponse = Record<string, unknown> & { token?: string };

  const authenticateWithDemoAccount = async (
    account: { name: string; email: string; password: string; role: UserRole }
  ): Promise<AuthResponse> => {
    try {
      return await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: account.email,
          password: account.password
        }
      });
    } catch (error) {
      const canRegisterFallback = error instanceof ApiError && [400, 401, 404].includes(error.status);
      if (!canRegisterFallback) {
        throw error;
      }

      try {
        await apiRequest<AuthResponse>('/auth/register', {
          method: 'POST',
          body: {
            name: account.name,
            email: account.email,
            password: account.password,
            role: account.role
          }
        });
      } catch (registerError) {
        if (!(registerError instanceof ApiError) || registerError.status !== 400) {
          throw registerError;
        }
      }

      return apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: {
          email: account.email,
          password: account.password
        }
      });
    }
  };

  // Initialize session from local storage and backend profile
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    }

    const token = getStoredToken();
    if (!token) {
      return;
    }

    let isMounted = true;
    const hydrateUser = async () => {
      try {
        const me = await apiRequest<Record<string, unknown>>('/auth/me', { token });
        if (!isMounted) {
          return;
        }

        const mappedUser = mapUser(me);
        persistUser(mappedUser, token);
      } catch {
        if (!isMounted) {
          return;
        }
        clearSession();
      }
    };

    void hydrateUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (role: UserRole) => {
    const account = DEMO_ACCOUNTS[role];
    if (!account) {
      throw new Error(`Unsupported login role: ${role}`);
    }

    const authResult = await authenticateWithDemoAccount(account);
    const mappedUser = mapUser(authResult);
    const token = typeof authResult.token === 'string' ? authResult.token : null;

    persistUser(mappedUser, token);
  };

  const logout = () => {
    clearSession();
  };

  const submitDriverApplication = async (payload?: DriverApplicationPayload) => {
    if (!user) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to submit a driver application.');
    }

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

    const updatedUser = mapUser(response.user || user);
    persistUser(updatedUser, token);
  };

  const addChild = async (child: Child) => {
    if (!user) {
      return;
    }

    const token = getStoredToken();
    if (!token) {
      throw new Error('You must be logged in to add a child.');
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
      : [...(user.children || []), mapChild(response.child || child)];

    const updatedUser: User = {
      ...user,
      children: nextChildren
    };

    persistUser(updatedUser, token);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, submitDriverApplication, addChild }}>
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
