'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import {
  CARRIER_TYPES,
  CARGO_CAPABILITIES,
  CONTAINER_EQUIPMENT,
  RATE_STRUCTURES,
  BID_CURRENCIES,
  ISO_COUNTRIES,
  PORT_ROLES,
  searchPorts,
  validateImoCompanyNumber,
  validateScacCode,
  type CallingPort,
  type PortRole,
  type TradeLane,
} from '@/lib/oceanCarrier';

export interface OceanCarrierFormValue {
  legal_company_name: string;
  country_code: string;
  imo_company_number: string;
  scac_code: string;
  carrier_type: string;
  cargo_capabilities: string[];
  container_equipment: string[];
  calling_ports: CallingPort[];
  trade_lanes: TradeLane[];
  rate_structure: string;
  thc_surcharge: string;
  bunker_surcharge: string;
  other_surcharges: string;
  accepted_currencies: string[];
}

export const EMPTY_OCEAN_CARRIER_FORM: OceanCarrierFormValue = {
  legal_company_name: '',
  country_code: '',
  imo_company_number: '',
  scac_code: '',
  carrier_type: '',
  cargo_capabilities: [],
  container_equipment: [],
  calling_ports: [],
  trade_lanes: [],
  rate_structure: '',
  thc_surcharge: '',
  bunker_surcharge: '',
  other_surcharges: '',
  accepted_currencies: ['USD'],
};

export function oceanFormFromPartner(p: any): OceanCarrierFormValue {
  return {
    legal_company_name: p?.legal_company_name || '',
    country_code: p?.country_code || '',
    imo_company_number: p?.imo_company_number || '',
    scac_code: p?.scac_code || '',
    carrier_type: p?.carrier_type || '',
    cargo_capabilities: p?.cargo_capabilities || [],
    container_equipment: p?.container_equipment || [],
    calling_ports: Array.isArray(p?.calling_ports) ? p.calling_ports : [],
    trade_lanes: Array.isArray(p?.trade_lanes) ? p.trade_lanes : [],
    rate_structure: p?.rate_structure || '',
    thc_surcharge: p?.thc_surcharge != null ? String(p.thc_surcharge) : '',
    bunker_surcharge: p?.bunker_surcharge != null ? String(p.bunker_surcharge) : '',
    other_surcharges: p?.other_surcharges != null ? String(p.other_surcharges) : '',
    accepted_currencies: p?.accepted_currencies?.length ? p.accepted_currencies : ['USD'],
  };
}

export function oceanFormToPayload(f: OceanCarrierFormValue) {
  const num = (v: string) => (v.trim() !== '' && !Number.isNaN(parseFloat(v)) ? parseFloat(v) : null);
  return {
    legal_company_name: f.legal_company_name.trim() || null,
    country_code: f.country_code || null,
    imo_company_number: f.imo_company_number.trim() || null,
    scac_code: f.scac_code.trim().toUpperCase() || null,
    carrier_type: f.carrier_type || null,
    cargo_capabilities: f.cargo_capabilities,
    container_equipment: f.container_equipment,
    calling_ports: f.calling_ports,
    trade_lanes: f.trade_lanes,
    rate_structure: f.rate_structure || null,
    thc_surcharge: f.rate_structure === 'base_ocean_freight' ? num(f.thc_surcharge) : null,
    bunker_surcharge: f.rate_structure === 'base_ocean_freight' ? num(f.bunker_surcharge) : null,
    other_surcharges: f.rate_structure === 'base_ocean_freight' ? num(f.other_surcharges) : null,
    accepted_currencies: f.accepted_currencies.length ? f.accepted_currencies : ['USD'],
  };
}

export function validateOceanForm(f: OceanCarrierFormValue): string | null {
  if (f.imo_company_number.trim() && !validateImoCompanyNumber(f.imo_company_number)) {
    return 'رقم IMO للشركة يجب أن يتكون من 7 أرقام. / IMO Company Number must be exactly 7 digits.';
  }
  if (f.scac_code.trim() && !validateScacCode(f.scac_code.trim().toUpperCase())) {
    return 'رمز SCAC يجب أن يتكون من 2 إلى 4 أحرف إنجليزية. / SCAC must be 2-4 letters.';
  }
  return null;
}

interface Props {
  value: OceanCarrierFormValue;
  onChange: (next: OceanCarrierFormValue) => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-foreground hover:border-primary/50'
      }`}
    >
      {children}
    </button>
  );
}

export default function OceanCarrierFields({ value, onChange }: Props) {
  const [portQuery, setPortQuery] = useState('');
  const [portRole, setPortRole] = useState<PortRole>('origin');
  const [laneOrigin, setLaneOrigin] = useState('');
  const [laneDest, setLaneDest] = useState('');
  const [laneTransit, setLaneTransit] = useState('');

  const set = <K extends keyof OceanCarrierFormValue>(key: K, v: OceanCarrierFormValue[K]) =>
    onChange({ ...value, [key]: v });

  const toggle = (key: 'cargo_capabilities' | 'container_equipment' | 'accepted_currencies', item: string) => {
    const arr = value[key];
    set(key, arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item]);
  };

  const results = useMemo(() => searchPorts(portQuery), [portQuery]);

  const addPort = (locode: string) => {
    const port = results.find(p => p.locode === locode);
    if (!port) return;
    if (value.calling_ports.some(p => p.locode === port.locode && p.role === portRole)) return;
    set('calling_ports', [...value.calling_ports, { ...port, role: portRole }]);
  };

  const removePort = (locode: string, role: PortRole) =>
    set('calling_ports', value.calling_ports.filter(p => !(p.locode === locode && p.role === role)));

  const addLane = () => {
    const o = laneOrigin.trim().toUpperCase();
    const d = laneDest.trim().toUpperCase();
    if (!o || !d || o === d) return;
    if (value.trade_lanes.some(l => l.origin === o && l.destination === d)) return;
    set('trade_lanes', [...value.trade_lanes, { origin: o, destination: d, transit_days: laneTransit ? Number(laneTransit) : null }]);
    setLaneOrigin('');
    setLaneDest('');
    setLaneTransit('');
  };

  const portOptions = value.calling_ports.reduce<{ locode: string; name: string }[]>((acc, p) => {
    if (!acc.some(a => a.locode === p.locode)) acc.push({ locode: p.locode, name: p.name });
    return acc;
  }, []);

  const roleLabel = (r: PortRole) => PORT_ROLES.find(x => x.value === r)?.labelAr || r;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Identification & Accreditation */}
      <div className="p-4 border border-border rounded-xl space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="BuildingOffice2Icon" size={14} /> التعريف والاعتماد الدولي (Global Identification &amp; Accreditation)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">الاسم القانوني للناقل (Carrier Legal Name)</label>
            <input
              value={value.legal_company_name}
              onChange={e => set('legal_company_name', e.target.value)}
              className={inputClass}
              placeholder="e.g. Orient Overseas Container Line Ltd."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">دولة التأسيس (Country of Incorporation — ISO Alpha-2)</label>
            <select value={value.country_code} onChange={e => set('country_code', e.target.value)} className={inputClass}>
              <option value="">اختر الدولة</option>
              {ISO_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">نوع الناقل (Carrier Type)</label>
            <select value={value.carrier_type} onChange={e => set('carrier_type', e.target.value)} className={inputClass}>
              <option value="">اختر نوع الناقل</option>
              {CARRIER_TYPES.map(c => (
                <option key={c.value} value={c.value}>{c.labelEn} — {c.labelAr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">رقم IMO للشركة (IMO Company Number — 7 digits)</label>
            <input
              dir="ltr"
              inputMode="numeric"
              maxLength={7}
              value={value.imo_company_number}
              onChange={e => set('imo_company_number', e.target.value.replace(/\D/g, '').slice(0, 7))}
              className={inputClass}
              placeholder="1234567"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">رمز SCAC (Standard Carrier Alpha Code)</label>
            <input
              dir="ltr"
              maxLength={4}
              value={value.scac_code}
              onChange={e => set('scac_code', e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4))}
              className={inputClass}
              placeholder="OOLU"
            />
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="p-4 border border-border rounded-xl space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="CubeIcon" size={14} /> قدرات الأسطول والبضائع (Fleet &amp; Cargo Capabilities)
        </p>
        <div className="flex flex-wrap gap-2">
          {CARGO_CAPABILITIES.map(c => (
            <Chip key={c.value} active={value.cargo_capabilities.includes(c.value)} onClick={() => toggle('cargo_capabilities', c.value)}>
              {c.labelEn}
            </Chip>
          ))}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">المعدات المدعومة (Container Equipment Supported)</p>
          <div className="flex flex-wrap gap-2">
            {CONTAINER_EQUIPMENT.map(c => (
              <Chip key={c.value} active={value.container_equipment.includes(c.value)} onClick={() => toggle('container_equipment', c.value)}>
                {c.labelEn}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Ports & Trade Lanes */}
      <div className="p-4 border border-border rounded-xl space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="MapPinIcon" size={14} /> تغطية الموانئ والمسارات (UN/LOCODE Port Coverage &amp; Trade Lanes)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            dir="ltr"
            value={portQuery}
            onChange={e => setPortQuery(e.target.value)}
            placeholder="ابحث: SAJED / Jeddah / CN"
            className={`${inputClass} md:col-span-2`}
          />
          <select value={portRole} onChange={e => setPortRole(e.target.value as PortRole)} className={inputClass}>
            {PORT_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.labelEn} — {r.labelAr}</option>
            ))}
          </select>
        </div>
        <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border">
          {results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">لا توجد نتائج</p>
          ) : (
            results.map(p => (
              <button
                type="button"
                key={p.locode}
                onClick={() => addPort(p.locode)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 text-start"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="font-mono text-muted-foreground" dir="ltr">{p.locode}</span>
              </button>
            ))
          )}
        </div>
        {value.calling_ports.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {value.calling_ports.map(p => (
              <span
                key={`${p.locode}-${p.role}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs"
              >
                <span className="font-mono" dir="ltr">{p.locode}</span> {p.name} · {roleLabel(p.role)}
                <button type="button" onClick={() => removePort(p.locode, p.role)} aria-label="remove port">
                  <Icon name="XMarkIcon" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">المسارات الملاحية المخدومة (Serviced Trade Lanes)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select value={laneOrigin} onChange={e => setLaneOrigin(e.target.value)} className={inputClass}>
              <option value="">من (Origin)</option>
              {portOptions.map(p => <option key={p.locode} value={p.locode}>{p.locode} — {p.name}</option>)}
            </select>
            <select value={laneDest} onChange={e => setLaneDest(e.target.value)} className={inputClass}>
              <option value="">إلى (Discharge)</option>
              {portOptions.map(p => <option key={p.locode} value={p.locode}>{p.locode} — {p.name}</option>)}
            </select>
            <input
              dir="ltr"
              type="number"
              min="0"
              value={laneTransit}
              onChange={e => setLaneTransit(e.target.value)}
              placeholder="Transit days"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addLane}
              disabled={!laneOrigin || !laneDest}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              إضافة مسار
            </button>
          </div>
          {value.trade_lanes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {value.trade_lanes.map(l => (
                <span
                  key={`${l.origin}-${l.destination}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs"
                >
                  <span className="font-mono" dir="ltr">{l.origin} → {l.destination}</span>
                  {l.transit_days ? <span>· {l.transit_days}d</span> : null}
                  <button
                    type="button"
                    onClick={() => set('trade_lanes', value.trade_lanes.filter(x => !(x.origin === l.origin && x.destination === l.destination)))}
                    aria-label="remove lane"
                  >
                    <Icon name="XMarkIcon" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Commercial Terms */}
      <div className="p-4 border border-border rounded-xl space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="BanknotesIcon" size={14} /> الشروط التجارية (Commercial Terms)
        </p>
        <div className="flex flex-wrap gap-2">
          {RATE_STRUCTURES.map(r => (
            <Chip key={r.value} active={value.rate_structure === r.value} onClick={() => set('rate_structure', r.value)}>
              {r.labelEn}
            </Chip>
          ))}
        </div>
        {value.rate_structure === 'base_ocean_freight' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {([
              ['thc_surcharge', 'THC (Terminal Handling)'],
              ['bunker_surcharge', 'Bunker / BAF Surcharge'],
              ['other_surcharges', 'Other Surcharges'],
            ] as const).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                <input
                  dir="ltr"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value[key]}
                  onChange={e => set(key, e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">العملات المقبولة للتسعير (Bidding Currencies)</p>
          <div className="flex flex-wrap gap-2">
            {BID_CURRENCIES.map(c => (
              <Chip key={c} active={value.accepted_currencies.includes(c)} onClick={() => toggle('accepted_currencies', c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
