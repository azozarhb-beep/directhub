'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TrackingLog {
  id: string;
  shipment_id: string;
  event_type: string;
  event_description: string;
  location: string | null;
  occurred_at: string;
  created_by: string | null;
  metadata: Record<string, unknown> | null;
}

interface Shipment {
  id: string;
  order_id: string | null;
  tracking_number: string;
  carrier_name: string | null;
  origin_address: string | null;
  destination_address: string | null;
  shipment_status: string;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  created_at: string;
  updated_at: string;
  tracking_logs?: TrackingLog[];
}

interface ShipmentTimelineProps {
  shipmentId?: string;
  orderId?: string;
  trackingNumber?: string;
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  picked_up: 'bg-blue-100 text-blue-800 border-blue-200',
  in_transit: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  out_for_delivery: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  failed_delivery: 'bg-red-100 text-red-800 border-red-200',
  returned: 'bg-orange-100 text-orange-800 border-orange-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
};

const EVENT_ICONS: Record<string, string> = {
  created: '📦',
  picked_up: '🚚',
  in_transit: '🛣️',
  arrived_at_hub: '🏭',
  out_for_delivery: '🏠',
  delivered: '✅',
  failed_delivery: '❌',
  returned: '↩️',
  customs_clearance: '🛃',
  exception: '⚠️',
  default: '📍',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  picked_up: 'تم الاستلام',
  in_transit: 'في الطريق',
  out_for_delivery: 'خارج للتسليم',
  delivered: 'تم التسليم',
  failed_delivery: 'فشل التسليم',
  returned: 'مُعاد',
  cancelled: 'ملغي',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-YE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ShipmentTimeline({
  shipmentId,
  orderId,
  trackingNumber,
  className = '',
}: ShipmentTimelineProps) {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shipmentId && !orderId && !trackingNumber) {
      setLoading(false);
      return;
    }
    fetchShipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId, orderId, trackingNumber]);

  async function fetchShipment() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('logistics_shipments')
        .select(`
          *,
          tracking_logs:shipment_tracking_logs(*)
        `)
        .order('occurred_at', { referencedTable: 'shipment_tracking_logs', ascending: true });

      if (shipmentId) {
        query = query.eq('id', shipmentId);
      } else if (orderId) {
        query = query.eq('order_id', orderId);
      } else if (trackingNumber) {
        query = query.eq('tracking_number', trackingNumber);
      }

      const { data, error: fetchError } = await query.maybeSingle();

      if (fetchError) throw fetchError;
      setShipment(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل بيانات الشحنة';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="space-y-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-xl border border-red-200 p-6 ${className}`}>
        <div className="flex items-center gap-3 text-red-600">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold">خطأ في تحميل بيانات الشحنة</p>
            <p className="text-sm text-red-500 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchShipment}
          className="mt-4 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 p-6 text-center ${className}`}>
        <span className="text-4xl block mb-3">📦</span>
        <p className="text-gray-500 font-medium">لا توجد بيانات شحنة متاحة</p>
        <p className="text-gray-400 text-sm mt-1">
          {!shipmentId && !orderId && !trackingNumber
            ? 'يرجى تحديد معرّف الشحنة أو رقم الطلب أو رقم التتبع' :'لم يتم العثور على شحنة بهذه البيانات'}
        </p>
      </div>
    );
  }

  const logs = shipment.tracking_logs ?? [];
  const statusColor = STATUS_COLORS[shipment.shipment_status] ?? STATUS_COLORS.pending;
  const statusLabel = STATUS_LABELS[shipment.shipment_status] ?? shipment.shipment_status;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`} dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-l from-blue-600 to-blue-700 px-6 py-4 text-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold">تتبع الشحنة</h2>
            <p className="text-blue-100 text-sm mt-0.5">
              رقم التتبع: <span className="font-mono font-semibold text-white">{shipment.tracking_number}</span>
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Shipment Info */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {shipment.carrier_name && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-base">🚚</span>
              <span>الناقل: <strong className="text-gray-800">{shipment.carrier_name}</strong></span>
            </div>
          )}
          {shipment.origin_address && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-base">📤</span>
              <span>من: <strong className="text-gray-800">{shipment.origin_address}</strong></span>
            </div>
          )}
          {shipment.destination_address && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-base">📥</span>
              <span>إلى: <strong className="text-gray-800">{shipment.destination_address}</strong></span>
            </div>
          )}
          {shipment.estimated_delivery && (
            <div className="flex items-center gap-2 text-gray-600">
              <span className="text-base">📅</span>
              <span>
                التسليم المتوقع:{' '}
                <strong className="text-gray-800">{formatDate(shipment.estimated_delivery)}</strong>
              </span>
            </div>
          )}
          {shipment.actual_delivery && (
            <div className="flex items-center gap-2 text-green-600">
              <span className="text-base">✅</span>
              <span>
                تاريخ التسليم الفعلي:{' '}
                <strong>{formatDate(shipment.actual_delivery)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-6 py-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          سجل التتبع
        </h3>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="text-3xl block mb-2">🔍</span>
            <p className="text-sm">لا توجد أحداث تتبع مسجّلة بعد</p>
          </div>
        ) : (
          <ol className="relative border-r-2 border-gray-200 space-y-0 mr-3">
            {logs.map((log, index) => {
              const icon = EVENT_ICONS[log.event_type] ?? EVENT_ICONS.default;
              const isLast = index === logs.length - 1;

              return (
                <li key={log.id} className="mb-6 mr-6 last:mb-0">
                  {/* Dot */}
                  <span
                    className={`absolute -right-4 flex items-center justify-center w-8 h-8 rounded-full text-base ring-4 ring-white ${
                      isLast ? 'bg-blue-100' : 'bg-gray-100'
                    }`}
                  >
                    {icon}
                  </span>

                  {/* Content */}
                  <div
                    className={`p-4 rounded-lg border ${
                      isLast
                        ? 'bg-blue-50 border-blue-200' :'bg-white border-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p
                        className={`text-sm font-semibold ${
                          isLast ? 'text-blue-800' : 'text-gray-800'
                        }`}
                      >
                        {log.event_description}
                      </p>
                      <time className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatDate(log.occurred_at)}
                      </time>
                    </div>
                    {log.location && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <span>📍</span>
                        {log.location}
                      </p>
                    )}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">
                        {Object.entries(log.metadata).map(([key, val]) => (
                          <span key={key} className="inline-block ml-3">
                            <span className="font-medium">{key}:</span> {String(val)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
