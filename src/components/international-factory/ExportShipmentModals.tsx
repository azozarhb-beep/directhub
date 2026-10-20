'use client';

import React, { useState } from 'react';
import { X, MapPin, Ship, FileText, Anchor } from 'lucide-react';
import type { IntlRoomStrings } from '@/lib/internationalRoomI18n';

export interface ShipmentDetailsOrder {
  id: string;
  destination_country: string;
  buyer_name: string;
  product_name: string;
  total_value: number;
  incoterm: string;
  status: string;
  origin_port?: string;
  destination_port?: string;
  bl_number?: string;
  shipping_line?: string;
}

export interface ShipmentDocRow {
  id: string;
  label: string;
  statusLabel: string;
  statusCls: string;
}

interface ShipmentDetailsModalProps {
  order: ShipmentDetailsOrder;
  docs: ShipmentDocRow[];
  s: IntlRoomStrings;
  dir: 'rtl' | 'ltr';
  onClose: () => void;
}

export function ShipmentDetailsModal({ order, docs, s, dir, onClose }: ShipmentDetailsModalProps) {
  const val = (v?: string) => (v && v.trim() ? v : s.notProvided);
  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Anchor size={14} />, label: s.portOfOrigin, value: val(order.origin_port) },
    { icon: <MapPin size={14} />, label: s.destinationPort, value: val(order.destination_port) },
    { icon: <FileText size={14} />, label: s.blNumber, value: val(order.bl_number) },
    { icon: <Ship size={14} />, label: s.shippingLine, value: val(order.shipping_line) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      dir={dir}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white">{s.shipmentDetailsTitle}</h3>
            <p className="text-cyan-400 text-sm font-mono mt-0.5">{order.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="rounded-lg bg-slate-800/60 p-3">
            <p className="text-slate-500 text-xs">{s.buyer}</p>
            <p className="text-slate-100 mt-0.5">{order.buyer_name}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-3">
            <p className="text-slate-500 text-xs">{s.product}</p>
            <p className="text-slate-100 mt-0.5">{order.product_name}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-3">
            <p className="text-slate-500 text-xs">{s.destination}</p>
            <p className="text-slate-100 mt-0.5">{order.destination_country}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-3">
            <p className="text-slate-500 text-xs">{s.totalValue} · {s.incoterm}</p>
            <p className="text-slate-100 mt-0.5">${order.total_value.toLocaleString('en-US')} · {order.incoterm}</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-slate-400">
                {r.icon}
                {r.label}
              </span>
              <span className="text-slate-100 font-medium text-end">{r.value}</span>
            </div>
          ))}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-300 mb-2">{s.documentStatus}</h4>
          {docs.length === 0 ? (
            <p className="text-slate-500 text-sm">{s.noDocuments}</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
                  <span className="text-slate-200">{d.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.statusCls}`}>{d.statusLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-slate-800 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
        >
          {s.close}
        </button>
      </div>
    </div>
  );
}

export interface NewShipmentPayload {
  buyer_name: string;
  product_name: string;
  destination_country: string;
  quantity: number;
  unit: string;
  total_value: number;
  incoterm: string;
  container_count: number;
  hs_code: string;
  origin_port: string;
  destination_port: string;
  bl_number: string;
  shipping_line: string;
  shipment_date: string;
  eta: string;
}

interface NewShipmentModalProps {
  s: IntlRoomStrings;
  dir: 'rtl' | 'ltr';
  onClose: () => void;
  onSubmit: (payload: NewShipmentPayload) => void;
}

const INCOTERMS = ['EXW', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'];

export function NewShipmentModal({ s, dir, onClose, onSubmit }: NewShipmentModalProps) {
  const [form, setForm] = useState({
    buyer_name: '',
    product_name: '',
    destination_country: '',
    quantity: '',
    unit: 'pcs',
    total_value: '',
    incoterm: 'FOB',
    container_count: '1',
    hs_code: '',
    origin_port: '',
    destination_port: '',
    bl_number: '',
    shipping_line: '',
    shipment_date: '',
    eta: '',
  });
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.buyer_name.trim() || !form.product_name.trim() || !form.destination_country.trim()) {
      setError(s.requiredFields);
      return;
    }
    onSubmit({
      ...form,
      quantity: Number(form.quantity) || 0,
      total_value: Number(form.total_value) || 0,
      container_count: Number(form.container_count) || 1,
    });
  };

  const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none';
  const labelCls = 'block text-xs text-slate-400 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      dir={dir}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="text-base font-bold text-white">{s.newShipmentTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{s.fieldBuyer} *</label>
            <input className={inputCls} value={form.buyer_name} onChange={set('buyer_name')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldProduct} *</label>
            <input className={inputCls} value={form.product_name} onChange={set('product_name')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldDestinationCountry} *</label>
            <input className={inputCls} value={form.destination_country} onChange={set('destination_country')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldHsCode}</label>
            <input className={inputCls} value={form.hs_code} onChange={set('hs_code')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldQuantity}</label>
            <input type="number" min="0" className={inputCls} value={form.quantity} onChange={set('quantity')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldUnit}</label>
            <input className={inputCls} value={form.unit} onChange={set('unit')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldTotalValue}</label>
            <input type="number" min="0" className={inputCls} value={form.total_value} onChange={set('total_value')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldIncoterm}</label>
            <select className={inputCls} value={form.incoterm} onChange={set('incoterm')}>
              {INCOTERMS.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{s.fieldContainers}</label>
            <input type="number" min="1" className={inputCls} value={form.container_count} onChange={set('container_count')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldShippingLine}</label>
            <input className={inputCls} value={form.shipping_line} onChange={set('shipping_line')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldOriginPort}</label>
            <input className={inputCls} value={form.origin_port} onChange={set('origin_port')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldDestinationPort}</label>
            <input className={inputCls} value={form.destination_port} onChange={set('destination_port')} />
          </div>
          <div>
            <label className={labelCls}>{s.fieldBlNumber}</label>
            <input className={inputCls} value={form.bl_number} onChange={set('bl_number')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{s.fieldEtd}</label>
              <input type="date" className={inputCls} value={form.shipment_date} onChange={set('shipment_date')} />
            </div>
            <div>
              <label className={labelCls}>{s.fieldEta}</label>
              <input type="date" className={inputCls} value={form.eta} onChange={set('eta')} />
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-cyan-600 py-2 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors"
          >
            {s.submitShipment}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-slate-800 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            {s.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
