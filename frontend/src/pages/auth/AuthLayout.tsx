import type { ReactNode } from 'react';
import { Wallet } from 'lucide-react';
import { useAuth } from '../../auth/authContext';

/** Shared frame for the five auth routes, so they cannot drift apart visually. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { isConfigured } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Wallet className="h-7 w-7 text-indigo-600" aria-hidden="true" />
          <span className="text-xl font-semibold text-gray-900">PrimeLedger</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}

          {!isConfigured && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900"
            >
              Authentication is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> in <code>frontend/.env</code>, then reload.
            </p>
          )}

          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-6 text-center text-sm text-gray-600">{footer}</div>}
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-red-600">
      {message}
    </p>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}

export const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export const buttonClass =
  'w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white ' +
  'hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 ' +
  'focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
