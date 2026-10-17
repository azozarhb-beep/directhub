export interface ReferredFacilityStatus {
  registration_status?: string | null;
  is_approved?: boolean | null;
  is_active?: boolean | null;
}

// A referred facility counts as "active (approved)" when its status is APPROVED or ACTIVE (case-insensitive).
export function isApprovedOrActiveFacility(f: ReferredFacilityStatus): boolean {
  const status = String(f?.registration_status ?? '').toLowerCase();
  if (status === 'approved' || status === 'active') return true;
  return f?.is_approved === true && f?.is_active !== false && status !== 'rejected';
}
