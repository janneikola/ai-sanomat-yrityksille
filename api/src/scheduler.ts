import cron from 'node-cron';
import { collectAllNews } from './services/newsCollectorService.js';
import { processScheduledDigests } from './services/scheduleService.js';

export function startScheduler() {
  // Paivittainen keruuajo klo 06:00 Suomen aikaa
  cron.schedule(
    '0 6 * * *',
    async () => {
      console.log('Starting daily news collection...');
      try {
        const result = await collectAllNews();
        console.log(
          `Collection complete: ${result.collected} new items from ${result.sources} sources, ${result.errors} source errors`
        );
      } catch (error) {
        console.error('News collection failed:', error);
      }
    },
    {
      timezone: 'Europe/Helsinki',
    }
  );

  // Katsausten ajoitettu generointi klo 07:00 Suomen aikaa (1h keruun jalkeen)
  cron.schedule(
    '0 7 * * *',
    async () => {
      console.log('Starting scheduled digest generation...');
      try {
        const result = await processScheduledDigests();
        console.log(
          `Digest scheduling complete: ${result.successes} generated, ${result.failures} failed, ${result.skips} skipped`
        );
      } catch (error) {
        console.error('Scheduled digest generation failed:', error);
      }
    },
    {
      timezone: 'Europe/Helsinki',
    }
  );

  console.log('Scheduler started: collection 06:00, digests 07:00 EET');
}

export async function triggerCollection() {
  return collectAllNews();
}
