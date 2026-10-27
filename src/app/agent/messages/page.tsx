'use client';

import { useEffect } from 'react';

export default function AgentMessagesRedirectPage() {
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const target = new URLSearchParams();
    target?.set('tab', 'messaging');
    const recipientId = sp?.get('recipientId');
    const name = sp?.get('name');
    if (recipientId) target?.set('recipientId', recipientId);
    if (name) target?.set('name', name);
    window.location?.replace(`/agent/dashboard?${target?.toString()}`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground" dir="rtl">
      جارٍ فتح المحادثة...
    </div>
  );
}
