import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsSources, sourceHealthLogs } from '../db/schema.js';
import { sendAdminNotification } from './emailService.js';

type HealthStatus = 'green' | 'yellow' | 'red';

interface SourceHealthInput {
  isActive: boolean;
  consecutiveFailures: number;
  lastItemsAt: Date | null;
  lastItemCount: number | null;
}

/**
 * Laskee lahteen terveystilan puhtaana funktiona.
 * Prioriteetti: inactive -> red, failures >= 4 -> red, failures >= 2 -> yellow, stale -> yellow, green.
 */
export function computeHealthStatus(source: SourceHealthInput): HealthStatus {
  if (!source.isActive) return 'red';
  if (source.consecutiveFailures >= 4) return 'red';
  if (source.consecutiveFailures >= 2) return 'yellow';

  // Stale check: lastItemsAt exists AND 7+ days old AND lastItemCount === 0
  if (source.lastItemsAt && source.lastItemCount === 0) {
    const daysSince = (Date.now() - source.lastItemsAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSince >= 7) return 'yellow';
  }

  return 'green';
}

/**
 * Kirjaa yksittaisen hakuyrityksen sourceHealthLogs-tauluun.
 */
export async function logFetchAttempt(
  sourceId: number,
  success: boolean,
  itemCount: number,
  errorMessage?: string | null
): Promise<void> {
  await db.insert(sourceHealthLogs).values({
    sourceId,
    success,
    itemCount,
    errorMessage: errorMessage ?? null,
  });
}

/**
 * Paivittaa lahteen aggregaattisarakkeet newsSources-taulussa.
 * Onnistuessa nollaa perakkkaiset epaonnistumiset, paivittaa viimeisen onnistumisen ajankohdan.
 * Epaonnistuessa kasvattaa perakkkaiisten epaonnistumisten laskuria.
 */
export async function updateSourceHealth(
  sourceId: number,
  success: boolean,
  itemCount: number
): Promise<void> {
  if (success) {
    const updateData: Record<string, unknown> = {
      consecutiveFailures: 0,
      lastSuccessAt: new Date(),
      lastItemCount: itemCount,
    };
    // Update lastItemsAt only when items > 0
    if (itemCount > 0) {
      updateData.lastItemsAt = new Date();
    }
    await db
      .update(newsSources)
      .set(updateData)
      .where(eq(newsSources.id, sourceId));
  } else {
    await db
      .update(newsSources)
      .set({
        consecutiveFailures: sql`${newsSources.consecutiveFailures} + 1`,
      })
      .where(eq(newsSources.id, sourceId));
  }
}

/**
 * Tarkistaa pitaako lahde deaktivoida automaattisesti.
 * Jos perakkkaiset epaonnistumiset >= 5, deaktivoi ja ilmoittaa adminille.
 */
export async function checkAutoDisable(
  sourceId: number,
  consecutiveFailures: number
): Promise<void> {
  if (consecutiveFailures >= 5) {
    await db
      .update(newsSources)
      .set({ isActive: false })
      .where(eq(newsSources.id, sourceId));

    // Hae lahteen nimi ilmoitusta varten
    const [source] = await db
      .select({ name: newsSources.name })
      .from(newsSources)
      .where(eq(newsSources.id, sourceId));

    const sourceName = source?.name ?? `Source #${sourceId}`;

    await sendAdminNotification(
      `AI-Sanomat: Uutislahde deaktivoitu - ${sourceName}`,
      `<p>Uutislahde <strong>${sourceName}</strong> on deaktivoitu automaattisesti ${consecutiveFailures} perakkkaiisen epaonnistumisen jalkeen.</p><p>Tarkista lahde ja aktivoi uudelleen kun ongelma on korjattu.</p>`
    ).catch((e) => console.error('Failed to send auto-disable notification:', e));
  }
}

/**
 * Lahettaa ilmoituksen kun lahteen terveystasokynnys ylittyy.
 * Yellow (2 failures) tai Red (4 failures) kynnykset.
 */
export async function checkHealthTransitionNotification(
  sourceName: string,
  oldFailures: number,
  newFailures: number
): Promise<void> {
  // Yellow threshold: crossing from < 2 to >= 2
  if (oldFailures < 2 && newFailures >= 2) {
    await sendAdminNotification(
      `AI-Sanomat: Uutislahde varoitus - ${sourceName}`,
      `<p>Uutislahde <strong>${sourceName}</strong> on nyt keltaisella tasolla (${newFailures} perakkkaiista epaonnistumista).</p>`
    ).catch((e) => console.error('Failed to send health transition notification:', e));
  }

  // Red threshold: crossing from < 4 to >= 4
  if (oldFailures < 4 && newFailures >= 4) {
    await sendAdminNotification(
      `AI-Sanomat: Uutislahde kriittinen - ${sourceName}`,
      `<p>Uutislahde <strong>${sourceName}</strong> on nyt punaisella tasolla (${newFailures} perakkkaiista epaonnistumista).</p><p>Lahde deaktivoidaan automaattisesti yhden lisakerran jalkeen.</p>`
    ).catch((e) => console.error('Failed to send health transition notification:', e));
  }
}
