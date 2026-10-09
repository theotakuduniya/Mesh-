import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { streamServiceWorker } from './services/streamServiceWorker';

// Register Service Worker for HTTP 206 Virtual Stream Interception (/virtual-stream/video.mp4)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[SW] Service Worker registered successfully for scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[SW] Service Worker registration failed:', error);
      });
  });

  // Also initialize the streamServiceWorker range broker
  streamServiceWorker.register().catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
