import { notFound } from 'next/navigation';
import TestMSWClient from './TestMSWClient';

export default function TestMSWPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <TestMSWClient />;
}
