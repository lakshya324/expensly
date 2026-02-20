import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/shared/providers/ThemeProvider';
import { AuthProvider } from '@/shared/providers/AuthProvider';
import { AppRouter } from './app/router';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster richColors position="top-right" closeButton />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

