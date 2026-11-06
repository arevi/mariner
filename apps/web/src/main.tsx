import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@/styles/global.css';
import App from './App.tsx';
import { BrowserRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import './lib/posthog';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
