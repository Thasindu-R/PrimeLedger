import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './auth/AuthProvider';
import { createQueryClient } from './lib/queryClient';

// One client for the lifetime of the application. Created outside the render so
// a re-render cannot replace it and discard every cached query with it.
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Inside the router: the auth pages navigate, and the guards read the
              current location to send a user back where they were headed. */}
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
