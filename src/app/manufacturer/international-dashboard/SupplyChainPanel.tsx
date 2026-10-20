'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { getIntlRoomStrings } from '@/lib/internationalRoomI18n';
import {
  COMMODITIES,
  COUNTRIES,
  UNITS,
  getSupplyChainStrings,
  localizeCountry,
  localizeMaterial,
  localizeUnit,
} from '@/lib/supplyChainI18n';

type SupplyStatus = 'active' | 'delayed' | 'disrupted';

interface SupplyLine {
  id: string;
  materialKey: string | null;
  materialName: string;
  supplierName: string | null;
  countryCode: string | null;
  countryName: string | null;
  contractedQuantity: number | null;
  quantityUnit: string;
  portOfLoading: string | null;
  leadTimeDays: number;
  reliabilityScore: number;
  lastShipment: string | null;
  status: SupplyStatus;
}

interface SupplyLineRow {
  id: string;
  material_key: string | null;
  material_name: string;
  supplier_name: string | null;
  supplier_country_code: string | null;
  supplier_country_name: string | null;
  contracted_quantity: number | string | null;
  quantity_unit: string | null;
  port_of_loading: string | null;
  lead_time_days: number | null;
  reliability_score: number | null;
  last_shipment: string | null;
  status: string | null;
}

const mapRow = (r: SupplyLineRow): SupplyLine => ({
  id: r.id,
  materialKey: r.material_key,
  materialName: r.material_name,
  supplierName: r.supplier_name,
  countryCode: r.supplier_country_code,
  countryName: r.supplier_country_name,
  contractedQuantity: r.contracted_quantity === null || r.contracted_quantity === undefined ? null : Number(r.contracted_quantity),
  quantityUnit: r.quantity_unit || 'ton',
  portOfLoading: r.port_of_loading,
  leadTimeDays: r.lead_time_days ?? 0,
  reliabilityScore: r.reliability_score ?? 0,
  lastShipment: r.last_shipment,
  status: (r.status as SupplyStatus) || 'active',
});

const statusColor = (status: SupplyStatus) =>
  status === 'active' ? 'text-emerald-600' : status === 'delayed' ? 'text-amber-600' : 'text-red-600';

const EMPTY_FORM = {
  materialKey: '',
  customMaterial: '',
  supplierName: '',
  countryCode: '',
  contractedQuantity: '',
  quantityUnit: 'ton',
  portOfLoading: '',
  leadTimeDays: '30',
  status: 'active' as SupplyStatus,
};

export default function SupplyChainPanel() {
  const { user } = useAuth();
  const { language, isRTL } = useLanguage();
  const supabase = useMemo(() => createClient(), []);
  const s = getIntlRoomStrings(language);
  const sc = getSupplyChainStrings(language);

  const [lines, setLines] = useState<SupplyLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const flash = useCallback((text: string, error = false) => {
    setNotice({ text, error });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('factory_supply_lines')
      .select('*')
      .eq('manufacturer_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      flash(error.message || sc.tableMissing, true);
      setLines([]);
    } else {
      setLines(((data as SupplyLineRow[]) ?? []).map(mapRow));
    }
    setLoading(false);
  }, [user?.id, supabase, flash, sc.tableMissing]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const isCustom = form.materialKey === 'other' || !form.materialKey;
    const materialName = isCustom
      ? form.customMaterial.trim()
      : COMMODITIES[form.materialKey]?.en || form.customMaterial.trim();
    if (!materialName) {
      flash(sc.required, true);
      return;
    }
    const country = form.countryCode ? COUNTRIES[form.countryCode] : undefined;
    setSaving(true);
    const { error } = await supabase.from('factory_supply_lines').insert({
      manufacturer_id: user.id,
      material_key: isCustom ? null : form.materialKey,
      material_name: materialName,
      supplier_name: form.supplierName.trim() || null,
      supplier_country_code: form.countryCode || null,
      supplier_country_name: country ? country.en : null,
      contracted_quantity: form.contractedQuantity ? Number(form.contractedQuantity) : null,
      quantity_unit: form.quantityUnit,
      port_of_loading: form.portOfLoading.trim() || null,
      lead_time_days: form.leadTimeDays ? Math.max(0, Number(form.leadTimeDays)) : 30,
      status: form.status,
    });
    setSaving(false);
    if (error) {
      flash(`${sc.saveFailed}: ${error.message}`, true);
      return;
    }
    setShowModal(false);
    setForm(EMPTY_FORM);
    flash(s.saved);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('factory_supply_lines').delete().eq('id', id);
    if (error) {
      flash(error.message, true);
      return;
    }
    setLines(prev => prev.filter(l => l.id !== id));
    flash(sc.deleted);
  };

  const handleTrack = (line: SupplyLine) => {
    const material = localizeMaterial(line.materialKey, line.materialName, language);
    flash(sc.trackingNote(material, line.portOfLoading || ''));
  };

  const handleAlternative = (line: SupplyLine) => {
    const material = localizeMaterial(line.materialKey, line.materialName, language);
    flash(sc.alternativeNote(material));
    window.open(`/suppliers?q=${encodeURIComponent(line.materialName)}`, '_blank');
  };

  const statusLabel = (st: SupplyStatus) =>
    st === 'active' ? s.scActive : st === 'delayed' ? s.scDelayed : s.scDisrupted;

  const inputCls =
    'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          {sc.addBtn}
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            notice.error
              ? 'border-red-500/40 bg-red-500/10 text-red-300' :'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading && <p className="text-slate-500 text-sm">{sc.loading}</p>}
      {!loading && lines.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-400 text-sm">
          {sc.empty}
        </div>
      )}

      {lines.map(line => {
        const material = localizeMaterial(line.materialKey, line.materialName, language);
        const country = localizeCountry(line.countryCode, line.countryName, language);
        const qty =
          line.contractedQuantity !== null
            ? `${line.contractedQuantity} ${localizeUnit(line.quantityUnit, language)}`
            : sc.notSet;
        const needsAction = line.status === 'delayed' || line.status === 'disrupted';
        return (
          <div key={line.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white text-sm">{material}</p>
                  <span className={`text-xs font-medium ${statusColor(line.status)}`}>{statusLabel(line.status)}</span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  {s.supplier}: {line.supplierName ? `${line.supplierName} · ` : ''}
                  {country || sc.notSet}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-end">
                  <p className="text-white font-bold text-sm">{line.reliabilityScore}%</p>
                  <p className="text-slate-500 text-xs">{s.reliability}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(line.id)}
                  className="text-slate-500 hover:text-red-400 text-xs"
                  aria-label={sc.delete}
                  title={sc.delete}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: s.leadTime, value: s.daysUnit(line.leadTimeDays) },
                { label: s.lastShipment, value: line.lastShipment || sc.notSet },
                { label: sc.contractedQty, value: qty },
                { label: sc.portOfLoading, value: line.portOfLoading || sc.notSet },
              ].map(d => (
                <div key={d.label} className="bg-slate-800 rounded-lg p-2 text-center">
                  <p className="text-slate-500 text-xs">{d.label}</p>
                  <p className="text-white text-sm font-medium mt-0.5 break-words">{d.value}</p>
                </div>
              ))}
            </div>

            {needsAction && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTrack(line)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-medium hover:bg-blue-600/30"
                >
                  {sc.trackShipment}
                </button>
                <button
                  type="button"
                  onClick={() => handleAlternative(line)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/40 text-amber-300 text-xs font-medium hover:bg-amber-600/30"
                >
                  {sc.findAlternative}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => !saving && setShowModal(false)}
        >
          <form
            onSubmit={handleSave}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3"
          >
            <h3 className="text-white font-semibold">{sc.modalTitle}</h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{sc.commodity}</label>
              <select
                className={inputCls}
                value={form.materialKey}
                onChange={e => setForm({ ...form, materialKey: e.target.value })}
              >
                <option value="">{sc.chooseCommodity}</option>
                {Object.keys(COMMODITIES).map(k => (
                  <option key={k} value={k}>
                    {localizeMaterial(k, k, language)}
                  </option>
                ))}
                <option value="other">{sc.otherOption}</option>
              </select>
            </div>

            {(form.materialKey === 'other' || !form.materialKey) && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">{sc.customCommodity}</label>
                <input
                  className={inputCls}
                  value={form.customMaterial}
                  onChange={e => setForm({ ...form, customMaterial: e.target.value })}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{sc.supplierName}</label>
                <input
                  className={inputCls}
                  value={form.supplierName}
                  onChange={e => setForm({ ...form, supplierName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{sc.country}</label>
                <select
                  className={inputCls}
                  value={form.countryCode}
                  onChange={e => setForm({ ...form, countryCode: e.target.value })}
                >
                  <option value="">{sc.chooseCountry}</option>
                  {Object.keys(COUNTRIES).map(c => (
                    <option key={c} value={c}>
                      {localizeCountry(c, c, language)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{sc.contractedQty}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputCls}
                  value={form.contractedQuantity}
                  onChange={e => setForm({ ...form, contractedQuantity: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{sc.unit}</label>
                <select
                  className={inputCls}
                  value={form.quantityUnit}
                  onChange={e => setForm({ ...form, quantityUnit: e.target.value })}
                >
                  {UNITS.map(u => (
                    <option key={u} value={u}>
                      {localizeUnit(u, language)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{sc.portOfLoading}</label>
                <input
                  className={inputCls}
                  value={form.portOfLoading}
                  onChange={e => setForm({ ...form, portOfLoading: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{s.leadTime}</label>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={form.leadTimeDays}
                  onChange={e => setForm({ ...form, leadTimeDays: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">{sc.status}</label>
              <select
                className={inputCls}
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as SupplyStatus })}
              >
                <option value="active">{s.scActive}</option>
                <option value="delayed">{s.scDelayed}</option>
                <option value="disrupted">{s.scDisrupted}</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700"
              >
                {sc.cancel}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-60"
              >
                {saving ? sc.loading : sc.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
