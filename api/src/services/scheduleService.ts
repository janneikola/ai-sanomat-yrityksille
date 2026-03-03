import { eq, and, desc, gt, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, issues, newsItems, schedulerRuns } from '../db/schema.js';
import { sendAdminNotification } from './emailService.js';

type ScheduleFrequency = 'weekly' | 'biweekly' | 'monthly';

/**
 * Laskee ISO-viikkonumeron annetulle paivamaeralle.
 * Siirretty newsletterServicesta uudelleenkaytettavaksi.
 */
export function getISOWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Tarkistaa onko asiakas ajoitettu tanaan.
 * Puhdas funktio -- ei sivuvaikutuksia, testattavissa suoraan.
 */
export function isDueToday(
  frequency: ScheduleFrequency,
  preferredDay: number,
  biweeklyWeek: string | null,
  today?: Date
): boolean {
  const d = today ?? new Date();
  const dayOfWeek = d.getDay(); // 0=Sun..6=Sat

  if (dayOfWeek !== preferredDay) return false;

  if (frequency === 'weekly') {
    return true;
  }

  if (frequency === 'biweekly') {
    const isoWeek = getISOWeekNumber(d);
    const isEven = isoWeek % 2 === 0;
    if (biweeklyWeek === 'even') return isEven;
    if (biweeklyWeek === 'odd') return !isEven;
    // If no parity set, default to every week (treat as weekly)
    return true;
  }

  if (frequency === 'monthly') {
    // Only on the FIRST occurrence of the preferred day in the month
    const dayOfMonth = d.getDate();
    return dayOfMonth <= 7; // First occurrence is always within the first 7 days
  }

  return false;
}

/**
 * Palauttaa periodinumeron deduplication-kayttpon.
 * - weekly: ISO-viikkonumero (1-53)
 * - biweekly: Math.min(Math.ceil(isoWeek / 2), 26)
 * - monthly: kuukausi 1-12
 */
export function getPeriodNumber(frequency: ScheduleFrequency, date?: Date): number {
  const d = date ?? new Date();

  if (frequency === 'weekly') {
    return getISOWeekNumber(d);
  }

  if (frequency === 'biweekly') {
    const isoWeek = getISOWeekNumber(d);
    return Math.min(Math.ceil(isoWeek / 2), 26);
  }

  if (frequency === 'monthly') {
    return d.getMonth() + 1; // 1-12
  }

  return getISOWeekNumber(d);
}

/**
 * Etsii seuraavan ajoitetun paivamaaran fromDate-paivamaaran jalkeen.
 * Maksimi 35 paivan hakusilmukka.
 */
export function getNextScheduledDate(
  frequency: ScheduleFrequency,
  preferredDay: number,
  biweeklyWeek: string | null,
  fromDate?: Date
): Date {
  const start = fromDate ?? new Date();
  const candidate = new Date(start);
  // Always start searching from the next day
  candidate.setDate(candidate.getDate() + 1);

  for (let i = 0; i < 35; i++) {
    if (isDueToday(frequency, preferredDay, biweeklyWeek, candidate)) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
  }

  // Fallback: should never reach here with valid inputs
  throw new Error(`Could not find next scheduled date within 35 days`);
}

/**
 * Paascheduler-funktio: kasittelee kaikki tanaan eraantyvat katsaukset.
 * Suorittaa asiakkaat perakkkain (ei Promise.all) API-nopeusrajoitusten vuoksi.
 */
export async function processScheduledDigests(): Promise<{
  processed: number;
  successes: number;
  failures: number;
  skips: number;
}> {
  const startedAt = new Date();
  let successes = 0;
  let failures = 0;
  let skips = 0;
  const notes: Array<{ clientId: number; clientName: string; result: string; detail?: string }> = [];

  // 1. Hae aktiiviset asiakkaat joilla ajoitus ei ole pysaytetty
  const activeClients = await db
    .select()
    .from(clients)
    .where(and(eq(clients.isActive, true), eq(clients.schedulePaused, false)));

  // 2. Suodata tanaan eraantyvat
  const dueClients = activeClients.filter((c) =>
    isDueToday(c.scheduleFrequency, c.scheduleDay, c.scheduleBiweeklyWeek)
  );

  // 3. Kasittele perakkkain
  for (const client of dueClients) {
    try {
      const year = new Date().getFullYear();
      const periodNumber = getPeriodNumber(client.scheduleFrequency);

      // Tarkista duplikaatti (sama clientId + periodNumber + year)
      const existingIssues = await db
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.clientId, client.id),
            eq(issues.year, year),
            eq(issues.periodNumber, periodNumber)
          )
        );

      if (existingIssues.length > 0) {
        skips++;
        notes.push({ clientId: client.id, clientName: client.name, result: 'skipped', detail: 'duplicate period' });
        continue;
      }

      // Maarita uutisikkuna (sinceDate)
      const lastIssue = await db
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.clientId, client.id),
            inArray(issues.status, ['sent', 'approved'])
          )
        )
        .orderBy(desc(issues.createdAt))
        .limit(1);

      const sinceDate = lastIssue.length > 0
        ? lastIssue[0].createdAt
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // First digest: last 7 days

      // Laske saatavilla olevat uutiset ikkunassa
      const availableNews = await db
        .select()
        .from(newsItems)
        .where(gt(newsItems.collectedAt, sinceDate));

      if (availableNews.length < 5) {
        // Alle kynnyksen -- laheta ilmoitus adminille ja ohita
        await sendAdminNotification(
          `AI-Sanomat: ${client.name} - uutisia alle kynnyksen`,
          `<p>Asiakas <strong>${client.name}</strong> oli ajoitettu tanaan, mutta uutisia loytyy vain ${availableNews.length} (kynnyarvo: 5).</p><p>Yritetaan uudelleen huomenna.</p>`
        );
        skips++;
        notes.push({ clientId: client.id, clientName: client.name, result: 'skipped', detail: `below threshold: ${availableNews.length} items` });
        continue;
      }

      // Generoi katsaus -- dynaminen tuonti valttaa kehariippuvuutta
      const { generateClientDigest } = await import('./newsletterService.js');
      const result = await generateClientDigest(client.id, sinceDate);

      // Onnistunut -- laheta ilmoitus adminille
      await sendAdminNotification(
        `AI-Sanomat: ${client.name} - katsausluonnos valmis`,
        `<p>Asiakkaan <strong>${client.name}</strong> katsausluonnos on valmis tarkistettavaksi.</p><p>Tila: ${result.status}</p><p><a href="${process.env.APP_URL || 'https://aisanomat.fi'}/admin/issues/${result.issueId}">Tarkista katsaus</a></p>`
      );

      successes++;
      notes.push({ clientId: client.id, clientName: client.name, result: 'success', detail: `issueId: ${result.issueId}` });
    } catch (error) {
      console.error(`Scheduled digest failed for client ${client.id} (${client.name}):`, error);

      await sendAdminNotification(
        `AI-Sanomat: ${client.name} - katsauksen generointi epaonnistui`,
        `<p>Asiakkaan <strong>${client.name}</strong> katsauksen generointi epaonnistui.</p><p>Virhe: ${String(error)}</p>`
      ).catch((e) => console.error('Failed to send admin notification:', e));

      failures++;
      notes.push({ clientId: client.id, clientName: client.name, result: 'failure', detail: String(error) });
    }
  }

  // 4. Kirjaa ajo schedulerRuns-tauluun
  await logSchedulerRun({
    startedAt,
    completedAt: new Date(),
    clientsProcessed: dueClients.length,
    successes,
    failures,
    skips,
    notes: JSON.stringify(notes),
  });

  return { processed: dueClients.length, successes, failures, skips };
}

/**
 * Tarkistaa kaynnistyessa onko tanaan ajettu ajoitettu ajo.
 * Jos ei, suorittaa processScheduledDigests().
 * Kutsutaan 30s viiveella serverin kaynnistyksen jalkeen.
 */
export async function checkAndRunMissedSchedule(): Promise<void> {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const latestRun = await db
    .select()
    .from(schedulerRuns)
    .orderBy(desc(schedulerRuns.startedAt))
    .limit(1);

  const hasRunToday =
    latestRun.length > 0 && latestRun[0].startedAt >= todayMidnight;

  if (!hasRunToday) {
    console.log('No scheduler run found for today, running catch-up...');
    await processScheduledDigests();
  } else {
    console.log('Scheduler already ran today, skipping catch-up.');
  }
}

/**
 * Kirjaa ajoitetun ajon tiedot tietokantaan.
 */
export async function logSchedulerRun(data: {
  startedAt: Date;
  completedAt: Date;
  clientsProcessed: number;
  successes: number;
  failures: number;
  skips: number;
  notes: string;
}): Promise<void> {
  await db.insert(schedulerRuns).values(data);
}
