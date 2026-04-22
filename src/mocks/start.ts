// src/mocks/start.ts
import { worker } from './browser';

declare global {
  interface Window {
    __RELIANCE_MSW_STARTED__?: boolean;
    __RELIANCE_MSW_STARTING__?: boolean;
  }
}

export async function startMockWorker() {
  if (typeof window === 'undefined') return;

  // React strict mode + HMR can run effect setup multiple times.
  // MSW should only be started once per browser session.
  if (window.__RELIANCE_MSW_STARTED__ || window.__RELIANCE_MSW_STARTING__) {
    return;
  }

  window.__RELIANCE_MSW_STARTING__ = true;

  try {
    await worker.start({ onUnhandledRequest: 'bypass' });
    window.__RELIANCE_MSW_STARTED__ = true;
    console.log('✅ MSW started in mock mode');
  } finally {
    window.__RELIANCE_MSW_STARTING__ = false;
  }
}


