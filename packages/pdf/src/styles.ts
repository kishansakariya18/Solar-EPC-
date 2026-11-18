export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&family=Noto+Sans+Gujarati:wght@400;600&display=swap" rel="stylesheet">`;

export const BASE_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --navy: #0f3557; --amber: #f0a500; --ink: #1c2530; --muted: #5b6673; --line: #d5dbe3; --tint: #eef1f5; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, 'Noto Sans Gujarati', system-ui, sans-serif; font-size: 9.2pt; line-height: 1.45; color: var(--ink); background: #fff; }
.page { width: 210mm; min-height: 296mm; padding: 11mm 12mm 9mm; position: relative; display: flex; flex-direction: column; break-after: page; break-inside: avoid; }
.page:last-child { break-after: auto; }
h1, h2, .brand { font-family: 'Space Grotesk', Inter, sans-serif; color: var(--navy); }
h2 { font-size: 11pt; margin: 12px 0 7px; }
.muted { color: var(--muted); }
.right { text-align: right; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.seller { display: flex; gap: 14px; }
.logo { width: 60px; height: 60px; border: 1px dashed #aab3bf; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 7.5pt; color: var(--muted); flex: none; overflow: hidden; }
.logo img { width: 100%; height: 100%; object-fit: contain; }
.brand { font-size: 17pt; font-weight: 700; line-height: 1.2; margin-bottom: 4px; }
.seller p { color: var(--muted); font-size: 9pt; line-height: 1.5; }
.doc-title { font-family: 'Space Grotesk', Inter, sans-serif; font-size: 22pt; font-weight: 700; color: var(--navy); letter-spacing: .5px; line-height: 1.1; text-align: right; }
.meta { margin-top: 6px; margin-left: auto; font-size: 9pt; border-collapse: collapse; }
.meta td { padding: 1.5px 0 1.5px 14px; text-align: right; }
.meta td:first-child { color: var(--muted); }
.meta td:last-child { font-weight: 700; }
.rule { height: 4px; background: var(--amber); border-radius: 2px; margin: 11px 0 13px; }
.cols { display: flex; gap: 14px; }
.cols > * { flex: 1; min-width: 0; }
.box { border: 1px solid var(--line); border-radius: 6px; padding: 9px 12px; }
.box.tint { background: var(--tint); }
.label { font-size: 8pt; font-weight: 700; letter-spacing: .8px; color: var(--navy); text-transform: uppercase; margin-bottom: 3px; }
.box .title { font-size: 11pt; font-weight: 600; margin-bottom: 2px; }
table.grid { width: 100%; border-collapse: collapse; font-size: 9pt; }
table.grid th, table.grid td { border: 1px solid var(--line); padding: 5px 8px; text-align: left; vertical-align: top; }
table.grid th { background: var(--tint); font-weight: 700; }
table.grid th.num, table.grid td.num { text-align: right; }
table.grid tr.total td { background: var(--tint); font-weight: 700; }
.sum { border: 1px solid var(--line); border-radius: 6px; overflow: hidden; font-size: 9pt; }
.sum .row { display: flex; justify-content: space-between; padding: 5.5px 11px; border-bottom: 1px solid #e6eaef; }
.sum .row:last-child { border-bottom: 0; }
.sum .row span:last-child { font-weight: 600; font-variant-numeric: tabular-nums; }
.sum .row.strong { background: var(--tint); font-weight: 700; }
.sum .row.final { background: var(--navy); color: #fff; font-weight: 700; font-size: 10.5pt; padding: 7.5px 11px; }
.sum .row.final span:last-child { font-weight: 700; }
.foot { margin-top: auto; padding-top: 8px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; font-size: 8.5pt; color: var(--muted); }
.small { font-size: 8.5pt; }
.draft { position: absolute; top: 42%; left: 0; right: 0; text-align: center; font-size: 90pt; font-weight: 700; color: rgba(15,53,87,.07); transform: rotate(-24deg); pointer-events: none; }
`;

export const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** dd-mm-yyyy in IST */
export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(new Date(v).getTime() + 5.5 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}-${p(d.getUTCMonth() + 1)}-${d.getUTCFullYear()}`;
}

export const UNIT_LABEL: Record<string, string> = { NOS: 'Nos', SET: 'Set', M: 'm', KW: 'kW', JOB: 'Job', LOT: 'Lot' };

export function page(title: string, css: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>${FONTS}<style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}
