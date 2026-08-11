import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../auth/authContext';
import { forgotPasswordSchema, type ForgotPasswordValues } from './authSchemas';
import { AuthLayout, FieldError, FormError, buttonClass, inputClass } from './AuthLayout';

export function ForgotPasswordPage() {
  const { requestPasswordReset, isConfigured } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setFormError(null);
    const { error } = await requestPasswordReset(values.email);

    if (error) {
      setFormError(error);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthLayout title="Check your inbox">
        <div className="flex flex-col items-center text-center gap-3">
          <MailCheck className="h-10 w-10 text-indigo-600" aria-hidden="true" />
          {/* Identical whether or not the address is registered (§9.3): a
              different message would let anyone test which emails have accounts. */}
          <p className="text-sm text-gray-600">
            If that address has an account, a reset link is on its way. It expires in one hour.
          </p>
          <Link to="/signin" className="font-medium text-indigo-600 hover:text-indigo-700">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link to="/signin" className="font-medium text-indigo-600 hover:text-indigo-700">
          Back to sign in
        </Link>
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

        <button type="submit" className={buttonClass} disabled={isSubmitting || !isConfigured}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  );
}
