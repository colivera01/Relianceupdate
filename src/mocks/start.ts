// src/mocks/start.ts
import { worker } from './browser';

export async function startMockWorker() {
  if (typeof window !== 'undefined') {
    await worker.start({ onUnhandledRequest: 'bypass' });
    console.log('✅ MSW started in mock mode');
  }
}


