import React from 'react';
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Welcome } from './pages/Welcome';
import { ParentDashboard } from './pages/ParentDashboard';
import { BookRide } from './pages/BookRide';
import { Carpool } from './pages/Carpool';
import { LiveTracking } from './pages/LiveTracking';
import { SafetyChat } from './pages/SafetyChat';
import { RideHistory } from './pages/RideHistory';
import { Profile, NotificationSettings, PaymentMethods } from './pages/Profile';
import { DriverSignup } from './pages/DriverSignup';
import { DriverLanding } from './pages/DriverLanding';
import { DriverDashboard } from './pages/DriverDashboard';
import { AddChild } from './pages/AddChild';
import { DriverMap } from './pages/DriverMap';
import { Earnings } from './pages/Earnings';
import { AuthProvider, getDefaultRouteForUser, useAuth } from './contexts/AuthContext';
import { RideProvider } from './contexts/RideContext';
import { HelpPage, PrivacyPage, TermsPage } from './pages/StaticPages';
import {
  FaqPage,
  ForDriversPage,
  LandingPage,
  MarketingAboutPage,
  MarketingContactPage,
  SafetyInfoPage
} from './pages/Marketing';
import { AdminApplications, AdminDrivers, AdminParents, AdminRides } from './pages/Admin';
import { UserRole } from './types';

const defaultRouteFor = getDefaultRouteForUser;

const LoadingScreen = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-sm font-medium text-gray-500">
    Restoring your session...
  </div>
);

const SignedOutOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, isHydrating } = useAuth();

  if (isHydrating) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to={defaultRouteFor(user)} replace />;
  }

  return children;
};

const ProtectedRoute: React.FC<{ children: React.ReactElement; roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, isHydrating } = useAuth();

  if (isHydrating) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles?.includes(UserRole.DRIVER) && user.role === UserRole.DRIVER && (!user.isVerifiedDriver || user.driverApplicationStatus !== 'approved')) return <Navigate to="/driver-signup" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultRouteFor(user)} replace />;
  }

  return children;
};

const AppRoutes = () => (
  <Layout>
    <Routes>
      <Route path="/" element={<SignedOutOnly><LandingPage /></SignedOutOnly>} />
      <Route path="/login" element={<SignedOutOnly><Welcome /></SignedOutOnly>} />
      <Route path="/about" element={<MarketingAboutPage />} />
      <Route path="/safety-info" element={<SafetyInfoPage />} />
      <Route path="/for-drivers" element={<ForDriversPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="/contact" element={<MarketingContactPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/drive" element={<DriverLanding />} />
      <Route path="/driver-signup" element={<DriverSignup />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={[UserRole.ADMIN]}>
            <AdminApplications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rides"
        element={
          <ProtectedRoute roles={[UserRole.ADMIN]}>
            <AdminRides />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/drivers" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminDrivers /></ProtectedRoute>} />
      <Route path="/admin/parents" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminParents /></ProtectedRoute>} />
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      <Route
        path="/driver-dashboard"
        element={
          <ProtectedRoute roles={[UserRole.DRIVER]}>
            <DriverDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/driver-map"
        element={
          <ProtectedRoute roles={[UserRole.DRIVER]}>
            <DriverMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/earnings"
        element={
          <ProtectedRoute roles={[UserRole.DRIVER]}>
            <Earnings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={[UserRole.PARENT]}>
            <ParentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-child"
        element={
          <ProtectedRoute roles={[UserRole.PARENT]}>
            <AddChild />
          </ProtectedRoute>
        }
      />
      <Route path="/edit-child/:id" element={<ProtectedRoute roles={[UserRole.PARENT]}><AddChild /></ProtectedRoute>} />
      <Route
        path="/book"
        element={
          <ProtectedRoute roles={[UserRole.PARENT]}>
            <BookRide />
          </ProtectedRoute>
        }
      />
      <Route
        path="/carpools"
        element={
          <ProtectedRoute roles={[UserRole.PARENT]}>
            <Carpool />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rides"
        element={
          <ProtectedRoute roles={[UserRole.PARENT]}>
            <RideHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracking/:id"
        element={
          <ProtectedRoute>
            <LiveTracking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/safety"
        element={
          <ProtectedRoute>
            <SafetyChat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/notifications"
        element={
          <ProtectedRoute>
            <NotificationSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/payments"
        element={
          <ProtectedRoute>
            <PaymentMethods />
          </ProtectedRoute>
        }
      />
    </Routes>
  </Layout>
);

const App = () => {
  return (
    <AuthProvider>
      <RideProvider>
        <Router>
          <AppRoutes />
        </Router>
      </RideProvider>
    </AuthProvider>
  );
};

export default App;
