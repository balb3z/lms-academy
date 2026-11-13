import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';


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
  
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('❌ Error rendering app:', error);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding: 20px; font-family: sans-serif; text-align: center; color: red;';
    const h1 = document.createElement('h1');
    h1.textContent = 'Error Loading App';
    const pre = document.createElement('pre');
    pre.style.cssText = 'background: #f5f5f5; padding: 10px; border-radius: 4px; text-align: left; overflow: auto; max-height: 300px;';
    pre.textContent = error instanceof Error ? error.stack || error.message : String(error);
    const btn = document.createElement('button');
    btn.textContent = 'Reload Page';
    btn.style.cssText = 'padding: 10px 20px; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;';
    btn.addEventListener('click', () => location.reload());
    wrap.append(h1, pre, btn);
    document.body.replaceChildren(wrap);
  }
}