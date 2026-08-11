import { Link } from 'react-router-dom';
import { CheckCircle2, MailWarning } from 'lucide-react';
import { useAuth } from '../../auth/authContext';
import { AuthLayout } from './AuthLayout';

/**
 * Where the confirmation email lands.
 *
 * <p>By the time this renders the SDK has already exchanged the token in the URL
 * for a session, so there is nothing to submit — the page only reports which of
 * the two outcomes happened.
 */
export function VerifyEmailPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <AuthLayout title="Verifying your email">
        <p className="text-sm text-gray-600" role="status">
          One moment…
        </p>
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout title="We couldn't verify that link">
        <div className="flex flex-col items-center text-center gap-3">
          <MailWarning className="h-10 w-10 text-amber-500" aria-hidden="true" />
          <p className="text-sm text-gray-600">
            The link may have expired or already been used. Signing in will send a fresh one if your
            address still needs confirming.
          </p>
          <Link to="/signin" className="font-medium text-indigo-600 hover:text-indigo-700">
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Email verified">
      <div className="flex flex-col items-center text-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden="true" />
        <p className="text-sm text-gray-600">
          You&apos;re all set — your account is ready to use.
        </p>
        <Link
          to="/overview"
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          Go to your ledger
        </Link>
      </div>
    </AuthLayout>
  );
}
