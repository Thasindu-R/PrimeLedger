import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignInPage } from './SignInPage';
import { TestAuthProvider } from '../../test/authHarness';
import type { AuthState } from '../../auth/authContext';

function renderSignIn(auth: Partial<AuthState> = {}) {
  return render(
    <MemoryRouter initialEntries={['/signin']}>
      <TestAuthProvider value={{ user: null, ...auth }}>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/overview" element={<p>Ledger</p>} />
        </Routes>
      </TestAuthProvider>
    </MemoryRouter>,
  );
}

describe('SignInPage', () => {
  it('rejects an empty submission before calling the API', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn();
    renderSignIn({ signIn });

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('rejects a malformed email before calling the API', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn();
    renderSignIn({ signIn });

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in and lands on the ledger', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ error: null });
    renderSignIn({ signIn });

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(signIn).toHaveBeenCalledWith('ada@example.com', 'hunter2hunter2');
    expect(await screen.findByText('Ledger')).toBeInTheDocument();
  });

  it('shows a failure message that does not reveal whether the account exists', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ error: 'Email or password is incorrect.' });
    renderSignIn({ signIn });

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email or password is incorrect/i);
    // Anything narrower would turn this form into an account-existence oracle.
    expect(alert).not.toHaveTextContent(/no account|not found|unknown user/i);
  });

  it('explains itself instead of failing when Supabase is not configured', async () => {
    renderSignIn({ isConfigured: false });

    expect(screen.getByRole('alert')).toHaveTextContent(/not configured/i);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
  });
});
