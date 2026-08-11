import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './authContext';

/**
 * Gate for the application routes.
 *
 * <p>The loading branch is the one that matters. Without it, the first render
 * happens before the stored session has been read, every guarded route sees a
 * null user, and a returning user with a perfectly valid session is bounced to
 * sign-in — an intermittent bug that looks like "sometimes it logs me out".
 *
 * <p>This is a convenience, not a control. It decides what to render; it does
 * not decide what data anybody can reach. That is the resource server's job,
 * and underneath it, row-level security's.
 */
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthPending />;

  if (!user) {
    // The attempted destination rides along so sign-in can return there.
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/** Inverse guard: someone already signed in has no use for the sign-in form. */
export function RequireAnonymous() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <AuthPending />;
  if (user) return <Navigate to="/overview" replace />;

  return <Outlet />;
}

function AuthPending() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm text-gray-500">Checking your session…</span>
    </div>
  );
}
