import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../../auth/authContext';
import { scorePassword, signUpSchema, type SignUpValues } from './authSchemas';
import { AuthLayout, FieldError, FormError, buttonClass, inputClass } from './AuthLayout';

export function SignUpPage() {
  const { signUp, isConfigured } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    // Live feedback as they type, which is what makes the strength meter useful.
    mode: 'onChange',
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  // useWatch rather than watch(): the latter returns a fresh function each
  // render, which the React Compiler cannot memoize.
  const password = useWatch({ control, name: 'password' });
  const strength = scorePassword(password ?? '');

  const onSubmit = async (values: SignUpValues) => {
    setFormError(null);
    const { error, needsEmailConfirmation } = await signUp(values.email, values.password);

    if (error) {
      setFormError(error);
      return;
    }

    if (needsEmailConfirmation) {
      setSentTo(values.email);
      return;
    }

    navigate('/overview', { replace: true });
  };

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a confirmation link to ${sentTo}.`}>
        <div className="flex flex-col items-center text-center gap-3">
          <MailCheck className="h-10 w-10 text-indigo-600" aria-hidden="true" />
          <p className="text-sm text-gray-600">
            Open the link to verify your address, then sign in. The link expires in 24 hours.
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
      title="Create your account"
      subtitle="Start tracking where your money goes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          <PasswordMeter score={strength.score} label={strength.label} />
          <FieldError message={errors.password?.message} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm password
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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}

const METER_COLOURS = [
  'bg-gray-200',
  'bg-red-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-emerald-600',
];

function PasswordMeter({ score, label }: { score: number; label: string }) {
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={`h-1 flex-1 rounded-full ${step <= score ? METER_COLOURS[score] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      {/* The meter itself is decorative; this is what a screen reader announces. */}
      <p className="mt-1 text-xs text-gray-600" aria-live="polite">
        Password strength: {label}
      </p>
    </div>
  );
}
