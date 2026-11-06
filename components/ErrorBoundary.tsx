import React from 'react';
import { captureError } from '../services/monitoring';

type State = { failed: boolean };

// Last line of defence: a crash in one page shows a calm recovery screen
// instead of a blank white page, and is reported when monitoring is on.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  declare props: Readonly<{ children: React.ReactNode }>;
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    captureError(error, { source: 'react', component: (info.componentStack || '').trim().split('\n')[0]?.trim().slice(0, 120) || 'unknown' });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm rounded-[20px] bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            This page hit an unexpected problem. Any ride in progress is still active. Reload to carry on.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 h-[52px] w-full rounded-full bg-brand font-semibold text-ink"
          >
            Reload KidRide
          </button>
        </div>
      </div>
    );
  }
}
