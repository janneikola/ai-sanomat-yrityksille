import cron from 'node-cron';
import { collectAllNews } from './services/newsCollectorService.js';

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

  console.log('Scheduler started: daily collection at 06:00 EET');
}

export async function triggerCollection() {
  return collectAllNews();
}
