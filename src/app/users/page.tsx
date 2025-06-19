'use client';

import React, { useState } from 'react';
import UserManagement from '@/src/components/UserManagement';
import { ActivityMonitoring } from '@/components/ActivityMonitoring';
import { AuditLog } from '@/components/AuditLog';

const TABS = [
  { label: 'User Management', value: 'users' },
  { label: 'Activity Monitoring', value: 'activity' },
  { label: 'Audit Log', value: 'audit' },
];

export default function UsersPage() {
  const [tab, setTab] = useState('users');

  return (
    <div className="p-4">
      <div className="mb-6 flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            className={`px-4 py-2 font-semibold border-b-2 transition-colors duration-150 focus:outline-none ${
              tab === t.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-blue-600'
            }`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === 'users' && <UserManagement />}
        {tab === 'activity' && <ActivityMonitoring />}
        {tab === 'audit' && <AuditLog />}
      </div>
    </div>
  );
} 