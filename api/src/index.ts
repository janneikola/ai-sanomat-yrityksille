import 'dotenv/config';
import { buildApp } from './app.js';
import { startScheduler } from './scheduler.js';

const port = Number(process.env.PORT) || 3000;

async function start() {
  const app = await buildApp();

  try {
    // Railway vaatii :: host-sidontaa (IPv6 kaikki rajapinnat)
    await app.listen({ port, host: '::' });
    console.log(`API käynnissä portissa ${port}`);
    startScheduler();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
