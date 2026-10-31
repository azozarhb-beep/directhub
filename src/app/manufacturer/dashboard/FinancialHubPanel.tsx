'use client';
import BankAccountsPanel from './BankAccountsPanel';

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
  // Kept for backward compatibility with existing callers (no longer rendered here)
  paymentSettings?: any;
  setPaymentSettings?: (v: any) => void;
  paymentLoading?: boolean;
  paymentSaving?: boolean;
  paymentError?: string;
  paymentSuccess?: string;
  handleSavePaymentSettings?: (e: React.FormEvent) => void;
  // shared
  t?: any;
  md: any;
}

export default function FinancialHubPanel(props: FinancialHubPanelProps) {
  return (
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
  );
}
