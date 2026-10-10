'use client';
import { useState } from 'react';
import BankAccountsPanel from './BankAccountsPanel';
import PaymentSettingsPanel from './PaymentSettingsPanel';
import AllSalesMethodsPanel from '@/components/AllSalesMethodsPanel';

type FinancialSubTab = 'bank_accounts' | 'payment_settings' | 'all_sales';

interface FinancialHubPanelProps {
  // BankAccountsPanel props
  bankAccounts: any[];
  bankAccountsLoading: boolean;
  showAddBankModal: boolean;
  setShowAddBankModal: (v: boolean) => void;
  bankFormData: any;
  setBankFormData: (v: any) => void;
  bankFormLoading: boolean;
  bankFormError: string;
  bankFormSuccess: string;
  deletingBankId: string | null;
  handleAddBankAccount: (e: React.FormEvent) => void;
  handleDeleteBankAccount: (id: string) => void;
  // PaymentSettingsPanel props
  paymentSettings: any;
  setPaymentSettings: (v: any) => void;
  paymentLoading: boolean;
  paymentSaving: boolean;
  paymentError: string;
  paymentSuccess: string;
  handleSavePaymentSettings: (e: React.FormEvent) => void;
  // shared
  t: any;
  md: any;
}

export default function FinancialHubPanel(props: FinancialHubPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<FinancialSubTab>('bank_accounts');

  const subTabs: { key: FinancialSubTab; label: string }[] = [
    { key: 'bank_accounts',    label: 'الحسابات البنكية' },
    { key: 'payment_settings', label: 'إعدادات البنك والدفع' },
    { key: 'all_sales',        label: 'كافة طرق البيع' },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === tab.key
                ? 'bg-blue-600 text-white' :'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'bank_accounts' && (
        <BankAccountsPanel
          bankAccounts={props.bankAccounts}
          bankAccountsLoading={props.bankAccountsLoading}
          showAddBankModal={props.showAddBankModal}
          setShowAddBankModal={props.setShowAddBankModal}
          bankFormData={props.bankFormData}
          setBankFormData={props.setBankFormData}
          bankFormLoading={props.bankFormLoading}
          bankFormError={props.bankFormError}
          bankFormSuccess={props.bankFormSuccess}
          deletingBankId={props.deletingBankId}
          handleAddBankAccount={props.handleAddBankAccount}
          handleDeleteBankAccount={props.handleDeleteBankAccount}
          md={props.md}
        />
      )}
      {activeSubTab === 'payment_settings' && (
        <PaymentSettingsPanel
          paymentSettings={props.paymentSettings}
          setPaymentSettings={props.setPaymentSettings}
          paymentLoading={props.paymentLoading}
          paymentSaving={props.paymentSaving}
          paymentError={props.paymentError}
          paymentSuccess={props.paymentSuccess}
          handleSavePaymentSettings={props.handleSavePaymentSettings}
          t={props.t}
          md={props.md}
        />
      )}
      {activeSubTab === 'all_sales' && (
        <div className="p-4 md:p-6">
          <AllSalesMethodsPanel />
        </div>
      )}
    </div>
  );
}
