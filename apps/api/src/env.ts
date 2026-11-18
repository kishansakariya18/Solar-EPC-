function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

function normalizeOrigin(v: string): string {
  const withScheme = /^https?:\/\//.test(v) ? v : `https://${v}`;
  return withScheme.replace(/\/+$/, '');
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 4000),
  // Accepts a full URL or a bare host (https:// is assumed); trailing slashes are dropped.
  webOrigin: normalizeOrigin(process.env.WEB_ORIGIN ?? 'http://localhost:3000'),
  pdfBrowserChannel: process.env.PDF_BROWSER_CHANNEL || undefined,
};
