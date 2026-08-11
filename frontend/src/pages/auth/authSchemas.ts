import { z } from 'zod';

/**
 * Client-side validation for the auth forms.
 *
 * <p>These rules are for the person filling the form in, not for security.
 * Supabase enforces its own password policy server-side and nothing here can be
 * relied on by the API — a determined caller simply skips the form. The value is
 * that a typo is caught before a round trip, and the rules stay in one place
 * instead of being spelled out slightly differently on each page.
 */

const email = z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.');

// Supabase's default minimum is 6; 8 is the more defensible floor and is what
// the strength meter is calibrated against.
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Passwords are limited to 72 characters.');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean().optional(),
});

export const signUpSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

/**
 * A deliberately simple estimate: length first, then variety. It is a hint to
 * the person choosing, not a gate — nothing refuses a password on this score.
 */
export function scorePassword(value: string): PasswordStrength {
  if (!value) return { score: 0, label: 'Enter a password' };

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;

  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const clamped = Math.min(score, 4) as PasswordStrength['score'];

  return { score: clamped, label: labels[clamped] };
}
