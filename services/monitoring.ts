// Error monitoring for the web app. Sentry is only downloaded and started when
// VITE_SENTRY_DSN is set at build time; otherwise every call is a no-op.
type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;
const pending: unknown[] = [];

export const initMonitoring = async (): Promise<void> => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || sentry) return;
  try {
    const module = await import('@sentry/react');
    module.init({
      dsn,
      environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) || import.meta.env.MODE,
      tracesSampleRate: 0,
      // Children's data: no session replay, no request bodies, cookies or headers.
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
          delete event.request.cookies;
          delete event.request.headers;
        }
        return event;
      }
    });
    sentry = module;
    pending.splice(0).forEach(error => module.captureException(error));
  } catch {
    // Monitoring must never stop the app from loading.
  }
};

export const captureError = (error: unknown, context?: Record<string, string>): void => {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  if (!sentry) {
    if (pending.length < 20) pending.push(error);
    return;
  }
  sentry.withScope(scope => {
    if (context) Object.entries(context).forEach(([key, value]) => scope.setTag(key, value));
    sentry?.captureException(error);
  });
};
