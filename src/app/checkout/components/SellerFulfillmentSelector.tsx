'use client';

import React, { useState, useRef } from 'react';

import Icon from '@/components/ui/AppIcon';

export type FulfillmentType = 'directhub_logistics' | 'seller_fulfilled';
export type IncotermType = 'EXW' | 'FOB' | 'CIF' | 'DDP' | 'DAP';

export interface SellerFulfillmentState {
  fulfillmentType: FulfillmentType;
  incotermType: IncotermType | '';
  localClearanceRequired: boolean;
}

interface SellerFulfillmentSelectorProps {
  value: SellerFulfillmentState;
  onChange: (v: SellerFulfillmentState) => void;
}

const INCOTERMS: { value: IncotermType; label: string; desc: string; color: string }[] = [
  { value: 'EXW', label: 'EXW', desc: 'تسليم المصنع — المشتري يتحمل كل التكاليف', color: 'text-gray-700' },
  { value: 'FOB', label: 'FOB', desc: 'تسليم على ظهر السفينة — المصنع يتحمل حتى الميناء', color: 'text-blue-700' },
  { value: 'CIF', label: 'CIF', desc: 'التكلفة + التأمين + الشحن — واصل للميناء', color: 'text-indigo-700' },
  { value: 'DDP', label: 'DDP', desc: 'تسليم مع دفع الرسوم — واصل لباب المستودع', color: 'text-emerald-700' },
  { value: 'DAP', label: 'DAP', desc: 'تسليم في المكان المحدد — دون دفع رسوم جمركية', color: 'text-amber-700' },
];

export default function SellerFulfillmentSelector({ value, onChange }: SellerFulfillmentSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Fulfillment Type Choice */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <Icon name="TruckIcon" size={14} className="text-primary" />
          اختر طريقة تلبية الشحن
        </p>
        <div className="grid grid-cols-1 gap-2">
          {/* Option 1: DirectHub Partners */}
          <button
            type="button"
            onClick={() => onChange({ ...value, fulfillmentType: 'directhub_logistics', incotermType: '', localClearanceRequired: false })}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              value.fulfillmentType === 'directhub_logistics' ?'border-blue-500 bg-blue-50' :'border-border bg-background hover:border-blue-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${value.fulfillmentType === 'directhub_logistics' ? 'bg-blue-100' : 'bg-muted'}`}>
              <Icon name="GlobeAltIcon" size={20} className={value.fulfillmentType === 'directhub_logistics' ? 'text-blue-700' : 'text-muted-foreground'} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${value.fulfillmentType === 'directhub_logistics' ? 'text-blue-900' : 'text-foreground'}`}>
                🚢 شحن عبر شركاء دايركت هب
              </p>
              <p className={`text-xs mt-0.5 leading-relaxed ${value.fulfillmentType === 'directhub_logistics' ? 'text-blue-700' : 'text-muted-foreground'}`}>
                إرسال طلب تسعير للمكاتب اللوجستية المعتمدة — أفضل أسعار وخدمة متكاملة
              </p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${value.fulfillmentType === 'directhub_logistics' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
              {value.fulfillmentType === 'directhub_logistics' && <Icon name="CheckIcon" size={11} className="text-white" />}
            </div>
          </button>

          {/* Option 2: Seller Fulfilled */}
          <button
            type="button"
            onClick={() => onChange({ ...value, fulfillmentType: 'seller_fulfilled', incotermType: '', localClearanceRequired: false })}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              value.fulfillmentType === 'seller_fulfilled' ?'border-emerald-500 bg-emerald-50' :'border-border bg-background hover:border-emerald-300'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${value.fulfillmentType === 'seller_fulfilled' ? 'bg-emerald-100' : 'bg-muted'}`}>
              <Icon name="BuildingOffice2Icon" size={20} className={value.fulfillmentType === 'seller_fulfilled' ? 'text-emerald-700' : 'text-muted-foreground'} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${value.fulfillmentType === 'seller_fulfilled' ? 'text-emerald-900' : 'text-foreground'}`}>
                🏭 شحن شامل بواسطة المصنع / البائع
              </p>
              <p className={`text-xs mt-0.5 leading-relaxed ${value.fulfillmentType === 'seller_fulfilled' ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                المصنع يتولى الشحن مباشرة — حدد شرط التسليم (Incoterm)
              </p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${value.fulfillmentType === 'seller_fulfilled' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`}>
              {value.fulfillmentType === 'seller_fulfilled' && <Icon name="CheckIcon" size={11} className="text-white" />}
            </div>
          </button>
        </div>
      </div>

      {/* Incoterm Selection (only for seller_fulfilled) */}
      {value.fulfillmentType === 'seller_fulfilled' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
            <Icon name="DocumentTextIcon" size={14} />
            شرط التسليم (Incoterm) <span className="text-red-500">*</span>
          </p>
          <div className="grid grid-cols-1 gap-2">
            {INCOTERMS.map((inc) => (
              <button
                key={inc.value}
                type="button"
                onClick={() => onChange({ ...value, incotermType: inc.value, localClearanceRequired: false })}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  value.incotermType === inc.value
                    ? 'border-emerald-500 bg-white shadow-sm'
                    : 'border-emerald-200 bg-white/60 hover:border-emerald-400'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-black text-sm ${
                  value.incotermType === inc.value ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {inc.value}
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-bold ${inc.color}`}>{inc.label}</p>
                  <p className="text-[11px] text-gray-600 leading-relaxed">{inc.desc}</p>
                </div>
                {value.incotermType === inc.value && (
                  <Icon name="CheckCircleIcon" size={18} className="text-emerald-600 shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Local Clearance Option (only for CIF) */}
          {value.incotermType === 'CIF' && (
            <div className="mt-2 bg-amber-50 border border-amber-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                  <Icon name="DocumentCheckIcon" size={18} className="text-amber-700" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900">خدمة التخليص الجمركي والنقل البري</p>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    هل تحتاج خدمة تخليص جمركي ونقل بري محلي داخل اليمن من شركاء دايركت هب؟
                  </p>
                  <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.localClearanceRequired}
                      onChange={(e) => onChange({ ...value, localClearanceRequired: e.target.checked })}
                      className="w-4 h-4 rounded accent-amber-600"
                    />
                    <span className="text-xs font-semibold text-amber-800">
                      نعم، أطلب خدمة التخليص الجمركي والنقل البري المحلي
                    </span>
                  </label>
                  {value.localClearanceRequired && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                      <Icon name="CheckBadgeIcon" size={14} className="text-amber-600 shrink-0" />
                      سيتم إرسال طلبك لشركاء التخليص الجمركي المعتمدين في اليمن
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* DDP info */}
          {value.incotermType === 'DDP' && (
            <div className="flex items-start gap-2.5 bg-emerald-100 border border-emerald-300 rounded-xl p-3">
              <Icon name="HomeModernIcon" size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800 leading-relaxed">
                <span className="font-bold">DDP:</span> المصنع يتحمل جميع التكاليف حتى باب مستودعك — بما فيها الرسوم الجمركية والنقل البري.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
