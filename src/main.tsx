import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill dynamic crypto.randomUUID safely for non-secure contexts (such as Electron running via file:// protocol)
try {
  const customUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }) as any;
  };

  if (typeof window !== 'undefined') {
    if (!window.crypto) {
      Object.defineProperty(window, 'crypto', {
        value: { randomUUID: customUUID },
        writable: true,
        configurable: true
      });
    } else if (!window.crypto.randomUUID) {
      try {
        window.crypto.randomUUID = customUUID;
      } catch (err) {
        // If window.crypto is read-only, redefine it on the window
        const originalCrypto = window.crypto;
        try {
          Object.defineProperty(window.crypto, 'randomUUID', {
            value: customUUID,
            writable: true,
            configurable: true
          });
        } catch (e2) {
          // If properties are completely non-configurable, redefine the whole crypto object
          try {
            const keys = Object.getOwnPropertyNames(originalCrypto);
            const mockedCrypto: any = { randomUUID: customUUID };
            for (const key of keys) {
              try {
                mockedCrypto[key] = (originalCrypto as any)[key];
              } catch (e3) {}
            }
            Object.defineProperty(window, 'crypto', {
              value: mockedCrypto,
              writable: true,
              configurable: true
            });
          } catch (e4) {
            console.error('[Polyfill] Could not override window.crypto:', e4);
          }
        }
      }
    }
  }
} catch (e) {
  console.error('[Polyfill] Safely caught error in crypto.randomUUID polyfill:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Progressive Web App Service Worker (only in standard web servers, not in local Electron file:// files)
if ('serviceWorker' in navigator && typeof window !== 'undefined' && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker registrado para funcionamiento local offline:', reg.scope);
      })
      .catch(err => {
        console.warn('[PWA] Fallo en el Service Worker:', err);
      });
  });
}
