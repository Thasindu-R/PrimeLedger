import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error('component exploded');
  return <p>recovered content</p>;
}

/** React logs caught render errors; silence it so the output stays readable. */
function silenceReactErrorLog() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('ErrorBoundary (FR-43)', () => {
  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows a recovery panel instead of blanking the page', () => {
    silenceReactErrorLog();

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/component exploded/i)).toBeInTheDocument();
  });

  it('reports the error to the handler it was given', () => {
    silenceReactErrorLog();
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'component exploded' }),
      expect.anything(),
    );
  });

  it('re-renders the children after Try again once the fault is gone', async () => {
    silenceReactErrorLog();
    const user = userEvent.setup();

    function Harness() {
      const [broken, setBroken] = useState(true);
      return (
        <>
          <button onClick={() => setBroken(false)}>fix it</button>
          <ErrorBoundary>
            <Boom shouldThrow={broken} />
          </ErrorBoundary>
        </>
      );
    }

    render(<Harness />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /fix it/i }));
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('recovered content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('uses a custom fallback when one is supplied', () => {
    silenceReactErrorLog();

    render(
      <ErrorBoundary fallback={(error) => <p>custom: {error.message}</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('custom: component exploded')).toBeInTheDocument();
  });
});
