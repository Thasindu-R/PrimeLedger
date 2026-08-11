import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAnonymous, RequireAuth } from './RequireAuth';
import { TestAuthProvider } from '../test/authHarness';
import type { AuthState } from './authContext';

function renderGuarded(auth: Partial<AuthState>, route = '/overview') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TestAuthProvider value={auth}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/overview" element={<p>Ledger</p>} />
          </Route>
          <Route element={<RequireAnonymous />}>
            <Route path="/signin" element={<p>Sign in form</p>} />
          </Route>
        </Routes>
      </TestAuthProvider>
    </MemoryRouter>,
  );
}

describe('RequireAuth', () => {
  it('renders the guarded route for a signed-in user', () => {
    renderGuarded({});
    expect(screen.getByText('Ledger')).toBeInTheDocument();
  });

  it('redirects an anonymous visitor to sign in', () => {
    renderGuarded({ user: null });
    expect(screen.getByText('Sign in form')).toBeInTheDocument();
  });

  it('waits rather than redirecting while the session is still loading', () => {
    // The regression this pins down: redirecting on the first render, before the
    // stored session has been read, signs out every returning user at random.
    renderGuarded({ user: null, isLoading: true });

    expect(screen.queryByText('Sign in form')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/checking your session/i);
  });
});

describe('RequireAnonymous', () => {
  it('shows the sign-in form to an anonymous visitor', () => {
    renderGuarded({ user: null }, '/signin');
    expect(screen.getByText('Sign in form')).toBeInTheDocument();
  });

  it('sends a signed-in user away from the sign-in form', () => {
    renderGuarded({}, '/signin');
    expect(screen.getByText('Ledger')).toBeInTheDocument();
  });
});
