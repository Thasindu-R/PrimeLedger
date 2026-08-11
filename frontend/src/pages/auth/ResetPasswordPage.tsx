import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { resetPasswordSchema, scorePassword, type ResetPasswordValues } from './authSchemas';
import { AuthLayout, FieldError, FormError, buttonClass, inputClass } from './AuthLayout';

/**
 * Reached from the emailed link. The SDK exchanges the token in the URL for a
 * session before this renders, so "is the link valid?" is answered by whether a
 * session exists — which is why the form is withheld until one does, rather than
 * letting someone fill it in and fail at the last step.
 */
export function ResetPasswordPage() {
  const { updatePassword, user, isLoading, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = useWatch({ control, name: 'password' });
  const strength = scorePassword(password ?? '');

  const onSubmit = async (values: ResetPasswordValues) => {
    setFormError(null);
    const { error } = await updatePassword(values.password);

    if (error) {
      setFormError(error);
      return;
    }

    navigate('/overview', { replace: true });
  };

  if (isLoading) {
    return (
      <AuthLayout title="Reset your password">
        <p className="text-sm text-gray-600" role="status">
          Checking your link…
        </p>
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout title="This link is no longer valid">
        <p className="text-sm text-gray-600">
          Reset links expire after an hour and can only be used once. Request a new one and it will
          arrive within a minute.
        </p>
        <Link
          to="/forgot-password"
          className="mt-4 inline-block font-medium text-indigo-600 hover:text-indigo-700"
        >
          Send another link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="You'll be signed in once it's saved.">
      <FormError message={formError} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <p className="mt-1 text-xs text-gray-600" aria-live="polite">
            Password strength: {strength.label}
          </p>
          <FieldError message={errors.password?.message} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        <button type="submit" className={buttonClass} disabled={isSubmitting || !isConfigured}>
          {isSubmitting ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthLayout>
  );
}
