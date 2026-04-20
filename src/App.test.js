import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Login from './pages/Login';
import { AuthProvider } from './context/AuthContext';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

test('renders login page', () => {
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  expect(screen.getByText(/PharmaDev Portal/i)).toBeInTheDocument();
});
