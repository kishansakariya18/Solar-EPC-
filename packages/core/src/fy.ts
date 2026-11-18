/** Indian financial year (Apr–Mar) for a date, evaluated in IST: "26-27". */
export function financialYear(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, '0');
  return `${two(start)}-${two(start + 1)}`;
}

/** ("NSE/", "26-27", 1, 4) → "NSE/26-27/0001" */
export function formatDocNumber(prefix: string, fy: string, n: number, padding = 4): string {
  return `${prefix}${fy}/${String(n).padStart(padding, '0')}`;
}
