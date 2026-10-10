'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function WarrantyInlineForm({ productId }: { productId: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [warranty, setWarranty] = useState<any>(null);
  const [months, setMonths] = useState(12);
  const [terms, setTerms] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('product_warranties').select('*').eq('product_id', productId).maybeSingle()
      .then(({ data }) => {
        if (data) { setWarranty(data); setMonths(data.warranty_period_months); setTerms(data.terms ?? ''); }
      });
  }, [productId]);

  const save = async () => {
    setSaving(true);
    if (warranty) {
      await supabase.from('product_warranties').update({ warranty_period_months: months, terms }).eq('id', warranty.id);
    } else {
      await supabase.from('product_warranties').insert({ product_id: productId, warranty_period_months: months, terms });
    }
    setSaving(false);
  };

  return (
    <div className="text-sm">
      <p className="text-slate-400 mb-2 font-medium">الضمان</p>
      <div className="flex gap-2 items-center flex-wrap">
        <input type="number" value={months} onChange={e => setMonths(Number(e.target.value))}
          className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs"
          placeholder="أشهر" min={1} />
        <span className="text-slate-400 text-xs">شهر</span>
        <input type="text" value={terms} onChange={e => setTerms(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-xs"
          placeholder="شروط الضمان (اختياري)" />
        <button onClick={save} disabled={saving}
          className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? '...' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
