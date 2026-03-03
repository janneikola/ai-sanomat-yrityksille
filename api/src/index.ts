import 'dotenv/config';
import { buildApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { checkAndRunMissedSchedule } from './services/scheduleService.js';

const port = Number(process.env.PORT) || 3000;

async function start() {
  const app = await buildApp();

  try {
    // Railway vaatii :: host-sidontaa (IPv6 kaikki rajapinnat)
    await app.listen({ port, host: '::' });
    console.log(`API käynnissä portissa ${port}`);
    startScheduler();

    // Kaynnistyksen catch-up: tarkista onko tanaan ajettu ajoitettu ajo
    // 30s viive jotta tietokanta ja palvelut ovat valmiina
    setTimeout(async () => {
      try {
        console.log('Running startup catch-up check...');
        await checkAndRunMissedSchedule();
      } catch (error) {
        console.error('Startup catch-up check failed:', error);
      }
    }, 30_000);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
