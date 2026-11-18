import { createApp } from './app';
import { prisma } from './db';
import { env } from './env';
import { closeBrowser } from './services/pdf.service';

const server = createApp().listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));

async function shutdown() {
  server.close();
  await Promise.all([closeBrowser(), prisma.$disconnect()]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
