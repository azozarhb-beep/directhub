export interface SalesRep {
  id: string;
  factory_owner_id: string;
  rep_user_id: string | null;
  invited_email: string;
  full_name: string;
  role: 'sales_rep' | 'senior_sales_rep';
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  invitation_sent_at: string;
  accepted_at: string | null;
  can_manage_products: boolean;
  can_view_inventory: boolean;
  can_respond_rfq: boolean;
  can_view_orders: boolean;
  notes: string | null;
}

export interface Product {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: number;
  minimum_order_qty: number;
  stock_quantity: number;
  inventory_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  origin_country: string;
  is_active: boolean;
  created_at: string;
  created_by_role?: 'agent' | 'manufacturer' | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  approval_status?: 'approved' | 'pending_factory_approval' | null;
}

export interface ProductFormData {
  name: string;
  name_ar: string;
  name_zh: string;
  name_tr: string;
  description: string;
  description_ar: string;
  description_zh: string;
  description_tr: string;
  specifications_en: string;
  specifications_ar: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: string;
  minimum_order_qty: string;
  stock_quantity: string;
  inventory_status: string;
  origin_country: string;
}

export interface PaymentSettings {
  id?: string;
  bank_name: string;
  bank_account_holder: string;
  iban: string;
  swift_code: string;
  account_number: string;
  bank_country: string;
  bank_city: string;
  bank_branch: string;
  bank_currency: string;
  usdt_trc20_address: string;
  usdt_erc20_address: string;
  bitcoin_address: string;
  ethereum_address: string;
  other_wallet_label: string;
  other_wallet_address: string;
  is_verified?: boolean;
  verified_at?: string | null;
  admin_note?: string;
  jawali_phone: string;
  jawali_account_name: string;
  jawali_pos_number: string;
  jawali_pos_name: string;
  jeeb_phone: string;
  jeeb_account_name: string;
  jeeb_pos_number: string;
  jeeb_pos_name: string;
  cash_phone: string;
  cash_account_name: string;
  cash_pos_number: string;
  cash_pos_name: string;
  floosk_phone: string;
  floosk_account_name: string;
  floosk_pos_number: string;
  floosk_pos_name: string;
  mobile_money_phone: string;
  mobile_money_account_name: string;
  mobile_money_pos_number: string;
  mobile_money_pos_name: string;
  kuraimi_phone: string;
  kuraimi_account_name: string;
  kuraimi_pos_number: string;
  kuraimi_pos_name: string;
}

export interface BankAccount {
  id: string;
  manufacturer_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  iban: string;
  swift_bic: string;
  currency: string;
  account_type: string;
  account_type_label: string;
  status: 'pending_review' | 'approved' | 'rejected';
  admin_note: string;
  is_primary: boolean;
  created_at: string;
}

export type DashboardTab =
  | 'products' |'financial_hub' |'escrow_orders' |'disputes' |'analytics' |'admin_messaging' |'finance' |'inventory' |'archive' |'sales_team' |'factory_orders' |'seller_fulfillment' |'freight_bids' |'contracts' |'factory_settings' |'invoicing' |'production';

export interface ManufacturerDashboardProps {
  /** When set, renders only this module full-screen with a sticky back header. */
  moduleTab?: DashboardTab;
  /** Optional sub-view for modules that merge several tabs (e.g. logistics). */
  moduleView?: string;
}
