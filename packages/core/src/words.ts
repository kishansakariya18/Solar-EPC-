import { D, Num, round2 } from './money';

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (r) parts.push(below100(r));
  return parts.join(' ');
}

/** Whole number in the Indian system (thousand, lakh, crore). */
export function numberToWordsIndian(n: bigint | number): string {
  let v = BigInt(n);
  if (v === 0n) return 'Zero';
  const parts: string[] = [];
  const crore = v / 10000000n;
  v %= 10000000n;
  const lakh = Number(v / 100000n);
  v %= 100000n;
  const thousand = Number(v / 1000n);
  const rest = Number(v % 1000n);
  if (crore > 0n) parts.push(`${numberToWordsIndian(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** 1089000 → "Rupees Ten Lakh Eighty-Nine Thousand Only". */
export function amountInWords(amount: Num): string {
  const d = round2(D(amount).abs());
  const rupees = BigInt(d.floor().toFixed(0));
  const paise = d.minus(d.floor()).times(100).toNumber();
  const r = `Rupees ${numberToWordsIndian(rupees)}`;
  return paise ? `${r} and Paise ${below100(Math.round(paise))} Only` : `${r} Only`;
}
