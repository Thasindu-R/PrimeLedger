import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignUpPage } from './SignUpPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { TestAuthProvider } from '../../test/authHarness';
import type { AuthState } from '../../auth/authContext';

function renderPage(element: React.ReactElement, auth: Partial<AuthState> = {}) {
  return render(
    <MemoryRouter initialEntries={['/x']}>
      <TestAuthProvider value={{ user: null, ...auth }}>
        <Routes>
          <Route path="/x" element={element} />
          <Route path="/overview" element={<p>Ledger</p>} />
        </Routes>
      </TestAuthProvider>
    </MemoryRouter>,
  );
}

describe('SignUpPage', () => {
  it('refuses a password shorter than the minimum', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn();
    renderPage(<SignUpPage />, { signUp });

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'short');
    await user.type(screen.getByLabelText(/confirm password/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('refuses a mismatched confirmation', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn();
    renderPage(<SignUpPage />, { signUp });

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.type(screen.getByLabelText(/confirm password/i), 'hunter2hunter3');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('rates password strength as it is typed', async () => {
    const user = userEvent.setup();
    renderPage(<SignUpPage />);

    await user.type(screen.getByLabelText(/^password$/i), 'abcdefgh');
    expect(screen.getByText(/password strength: weak/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^password$/i));
    await user.type(screen.getByLabelText(/^password$/i), 'Abcdefgh1234!');
    expect(screen.getByText(/password strength: strong/i)).toBeInTheDocument();
  });

  it('asks the user to check their inbox when confirmation is required', async () => {
    const user = userEvent.setup();
    const signUp = vi.fn().mockResolvedValue({ error: null, needsEmailConfirmation: true });
    renderPage(<SignUpPage />, { signUp });

    await user.type(screen.getByLabelText(/email/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.type(screen.getByLabelText(/confirm password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument();
  });
});

describe('ForgotPasswordPage', () => {
  it('gives the same answer whether or not the address is registered', async () => {
    const user = userEvent.setup();
    const requestPasswordReset = vi.fn().mockResolvedValue({ error: null });
    renderPage(<ForgotPasswordPage />, { requestPasswordReset });

    await user.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    // "If that address has an account" — never a confirmation that it does.
    expect(await screen.findByText(/if that address has an account/i)).toBeInTheDocument();
  });
});
