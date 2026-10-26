export interface ProductFreightParams {
  grossWeightKg: number | null;
  cartonVolumeCbm: number | null;
}

export interface FreightEstimateInput {
  grossWeightKg: number | null;
  cartonVolumeCbm: number | null;
  cartons: number;
  ratePerKg?: number;
  ratePerCbm?: number;
  minCharge?: number;
}

const toPositive = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function getProductFreightParams(
  specifications: Record<string, unknown> | null | undefined
): ProductFreightParams {
  const s = specifications || {};
  return {
    grossWeightKg: toPositive(s['gross_weight_kg']),
    cartonVolumeCbm: toPositive(s['carton_volume_cbm']),
  };
}

export function estimateFreightCost(input: FreightEstimateInput): number {
  const cartons = Math.max(1, Math.floor(input.cartons || 1));
  const byWeight = (input.grossWeightKg || 0) * cartons * (input.ratePerKg || 0);
  const byVolume = (input.cartonVolumeCbm || 0) * cartons * (input.ratePerCbm || 0);
  const charge = Math.max(byWeight, byVolume);
  return Math.max(charge, input.minCharge || 0);
}
