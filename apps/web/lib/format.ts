import { formatINR } from '@solar-epc/core';

export function inr(v: string | number | null | undefined, decimals = 2): string {
  if (v == null || v === '') return '—';
  const s = formatINR(v, { decimals });
  return s.startsWith('-') ? `–₹${s.slice(1)}` : `₹${s}`;
}
export const fmtDate = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
export const dateInput = (v: string | Date | null | undefined) => (v ? new Date(new Date(v).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : '');
export const today = () => dateInput(new Date());
export const plusDays = (n: number) => dateInput(new Date(Date.now() + n * 864e5));

export const UNITS = ['NOS', 'SET', 'M', 'KW', 'JOB', 'LOT'] as const;
export const UNIT_LABEL: Record<string, string> = { NOS: 'Nos', SET: 'Set', M: 'm', KW: 'kW', JOB: 'Job', LOT: 'Lot' };
export const CATEGORIES: Record<string, string> = {
  MODULE: 'Module', INVERTER: 'Inverter', STRUCTURE: 'Structure', CABLE_DC: 'DC cable', CABLE_AC: 'AC cable', DISTRIBUTION_BOX: 'ACDB / DCDB',
  EARTHING: 'Earthing', LIGHTNING_ARRESTER: 'Lightning arrester', NET_METER: 'Net meter', BATTERY: 'Battery', SERVICE: 'Service', OTHER: 'Other',
};
export const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
