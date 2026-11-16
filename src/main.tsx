import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Two-tier Maps quota listener for auto-provisioned demo key
(window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

// Prevent third-party browser extensions (e.g. MetaMask inpage.js) from surfacing uncaught errors in the preview
window.addEventListener(
  'unhandledrejection',
  (event) => {
    const reason = event.reason as { message?: string; stack?: string } | undefined;
    const stack = String(reason?.stack ?? '');
    const msg = String(reason?.message ?? reason ?? '');
    if (
      stack.includes('chrome-extension://') ||
      stack.includes('moz-extension://') ||
      msg.includes('Failed to connect to MetaMask')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

window.addEventListener(
  'error',
  (event) => {
    const filename = typeof event.filename === 'string' ? event.filename : '';
    const stack = String((event.error as { stack?: string } | undefined)?.stack ?? '');
    const msg = String(event.message ?? '');
    if (
      filename.startsWith('chrome-extension://') ||
      filename.startsWith('moz-extension://') ||
      stack.includes('chrome-extension://') ||
      msg.includes('Failed to connect to MetaMask')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

createRoot(document.getElementById('root')!).render(<App />);
