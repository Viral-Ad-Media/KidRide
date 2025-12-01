
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { AuthProvider } from './contexts/AuthContext';
import { RideProvider } from './contexts/RideContext';

const App = () => {
  return (
    <AuthProvider>
      <RideProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/drive" element={<DriverLanding />} />
              <Route path="/driver-signup" element={<DriverSignup />} />
              <Route path="/driver-dashboard" element={<DriverDashboard />} />
              <Route path="/driver-map" element={<DriverMap />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/dashboard" element={<ParentDashboard />} />
              <Route path="/add-child" element={<AddChild />} />
              <Route path="/book" element={<BookRide />} />
              <Route path="/carpools" element={<Carpool />} />
              <Route path="/rides" element={<RideHistory />} />
              <Route path="/tracking/:id" element={<LiveTracking />} />
              <Route path="/safety" element={<SafetyChat />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/notifications" element={<NotificationSettings />} />
              <Route path="/profile/payments" element={<PaymentMethods />} />
            </Routes>
          </Layout>
        </Router>
      </RideProvider>
    </AuthProvider>
  );
};

export default App;
