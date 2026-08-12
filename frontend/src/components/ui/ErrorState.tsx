import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** What the user was trying to see, e.g. "your transactions". */
  subject?: string;
}

/**
 * The actionable failure every async surface shows instead of a blank panel
 * (FR-42).
 *
 * <p>It reports the server's own message where there is one. A generic "
 * something went wrong" hides the difference between a validation rejection the
 * user can fix and a server fault they cannot, and leaves them retrying the
 * former forever.
 */
export function ErrorState({ error, onRetry, subject = 'this' }: ErrorStateProps) {
  const message = describe(error, subject);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50/40 py-12 px-6 text-center"
    >
      <AlertCircle className="text-red-400" size={32} />
      <p className="text-sm text-gray-700 max-w-md">{message}</p>

      {requestIdOf(error) && (
        // Worth showing: it is the one thing that lets a log be found later.
        <p className="text-xs text-gray-400">Reference: {requestIdOf(error)}</p>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      )}
    </div>
  );
}

function describe(error: unknown, subject: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Your session has expired. Sign in again to continue.';
    }
    if (error.status >= 500) {
      return `The server could not load ${subject} just now. This is our end, not yours.`;
    }
    return error.message;
  }

  if (error instanceof TypeError) {
    // fetch rejects with a TypeError when the request never reached a server.
    return `Could not reach the server. Check your connection and try again.`;
  }

  return `Something went wrong loading ${subject}.`;
}

function requestIdOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.requestId : undefined;
}
