import { notFound } from 'next/navigation';
import TestProfileToggleClient from './TestProfileToggleClient';

export default function TestProfileTogglePage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <TestProfileToggleClient />;
}
