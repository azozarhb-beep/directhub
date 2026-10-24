'use client';

import React from 'react';
import ManufacturerDashboard from '@/app/manufacturer/dashboard/page';
import FactoryModuleView from '@/components/manufacturer/FactoryModuleView';
import type { FactoryModuleKey } from '@/components/manufacturer/factoryModules';
import { useFactoryRoom, FactoryRoomSpinner } from '@/components/manufacturer/useFactoryRoom';

type LocalTab =
  | 'analytics' |'inventory' |'seller_fulfillment' |'sales_team' |'disputes' |'financial_hub' |'factory_orders' |'factory_settings' |'products' |'finance' |'escrow_orders' |'admin_messaging' |'archive' |'all_sales' |'contracts' |'invoicing' |'production';

interface ManufacturerModuleRouteProps {
  /** Local workspace tab rendered full-screen. */
  localTab: LocalTab;
  /** Optional sub-view (e.g. 'bids' for logistics). */
  view?: string;
  /** When set, international factories keep their existing module view. */
  internationalKey?: FactoryModuleKey;
}

/**
 * Full-screen module page. Local factories get the dashboard panel with a sticky
 * "← رجوع إلى لوحة التحكم" header; international factories keep their existing view.
 */
export default function ManufacturerModuleRoute({ localTab, view, internationalKey }: ManufacturerModuleRouteProps) {
  const room = useFactoryRoom();
  if (room === 'loading') return <FactoryRoomSpinner />;
  if (room === 'international' && internationalKey) {
    return <FactoryModuleView moduleKey={internationalKey} />;
  }
  return <ManufacturerDashboard moduleTab={localTab} moduleView={view} />;
}
