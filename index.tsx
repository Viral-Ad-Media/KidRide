import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { captureError, initMonitoring } from './services/monitoring';
import './index.css';

void initMonitoring();
window.addEventListener('error', event => captureError(event.error || event.message, { source: 'window' }));
window.addEventListener('unhandledrejection', event => captureError(event.reason, { source: 'promise' }));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);