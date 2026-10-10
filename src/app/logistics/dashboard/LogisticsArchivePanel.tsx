'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function LogisticsArchivePanel({ userId }: { userId: string | undefined }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('archive_records')
      .select('*, orders(order_number)')
      .contains('shared_with_roles', ['logistics'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRecords(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <p className="text-slate-400 text-sm">جاري التحميل...</p>;
  if (!records.length) return <p className="text-slate-400 text-sm">لا توجد مستندات مشتركة بعد.</p>;

  return (
    <div className="space-y-3">
      {records.map(r => (
        <div key={r.id} className="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">{r.title}</p>
            <p className="text-slate-400 text-xs mt-1">{r.type} • {new Date(r.created_at).toLocaleDateString('ar-SA')}</p>
          </div>
          {r.file_url && (
            <a href={r.file_url} target="_blank" rel="noopener noreferrer"
               className="text-blue-400 text-sm hover:underline">تحميل</a>
          )}
        </div>
      ))}
    </div>
  );
}
