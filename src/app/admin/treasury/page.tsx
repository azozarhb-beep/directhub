'use client';

import React from 'react';
import TreasuryPanel from '@/components/admin/TreasuryPanel';

export default function AdminTreasuryPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <TreasuryPanel />
      </div>
    </div>
  );
}
