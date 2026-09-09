import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

console.log('🚀 App starting...');
console.log('📦 Environment:', import.meta.env.MODE);
console.log('🔑 Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Not Set');
console.log('🔑 Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not Set');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found!');
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: sans-serif; text-align: center; color: red;">
      <h1>Error: Root element not found</h1>
      <p>Please check your HTML file</p>
    </div>
  `;
} else {
  console.log('✅ Root element found, rendering app...');
  
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>
    );
    console.log('✅ App rendered successfully');
  } catch (error) {
    console.error('❌ Error rendering app:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; text-align: center; color: red;">
        <h1>Error Loading App</h1>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; text-align: left; overflow: auto; max-height: 300px;">
          ${error instanceof Error ? error.stack || error.message : String(error)}
        </pre>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
          Reload Page
        </button>
      </div>
    `;
  }
}