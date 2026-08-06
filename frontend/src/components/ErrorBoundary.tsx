import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of the default panel; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Stops a fault in one component from blanking the whole page (FR-43). Phase 8
 * forwards `onError` to Sentry.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
      >
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-800 mb-1">
            Something went wrong
          </h1>
          <p className="text-sm text-gray-400 mb-6">
            The page hit an unexpected error. Your saved transactions are untouched.
          </p>
          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 mb-6 break-words">
            {error.message}
          </p>
          <button
            onClick={this.reset}
            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-xl transition-colors"
          >
            <RotateCw size={16} />
            Try again
          </button>
        </div>
      </div>
    );
  }
}
