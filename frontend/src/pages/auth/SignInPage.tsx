import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { signInSchema, type SignInValues } from './authSchemas';
import { AuthLayout, FieldError, FormError, buttonClass, inputClass } from './AuthLayout';

interface LocationState {
  from?: { pathname?: string };
}

export function SignInPage() {
  const { signIn, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '', remember: true },
  });

  // Back to wherever the guard interrupted, or the overview.
  const destination = (location.state as LocationState | null)?.from?.pathname ?? '/overview';

  const onSubmit = async (values: SignInValues) => {
    setFormError(null);
    const { error } = await signIn(values.email, values.password);

    if (error) {
      setFormError(error);
      return;
    }

    navigate(destination, { replace: true });
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back to your ledger."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-700">
            Create one
          </Link>
        </>
      }
    >
      <FormError message={formError} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <FieldError message={errors.password?.message} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            {...register('remember')}
          />
          Remember me
        </label>

        <button type="submit" className={buttonClass} disabled={isSubmitting || !isConfigured}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
