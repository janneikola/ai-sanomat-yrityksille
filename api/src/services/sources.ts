import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsSources } from '../db/schema.js';
import { computeHealthStatus } from './sourceHealthService.js';
import type { CreateSource, UpdateSource } from '@ai-sanomat/shared';

function withHealthStatus(source: typeof newsSources.$inferSelect) {
  return {
    ...source,
    healthStatus: computeHealthStatus({
      isActive: source.isActive,
      consecutiveFailures: source.consecutiveFailures,
      lastItemsAt: source.lastItemsAt,
      lastItemCount: source.lastItemCount,
    }),
  };
}

export async function listSources() {
  const rows = await db.select().from(newsSources).orderBy(newsSources.createdAt);
  return rows.map(withHealthStatus);
}

export async function getSource(id: number) {
  const rows = await db.select().from(newsSources).where(eq(newsSources.id, id));
  const row = rows[0] ?? null;
  return row ? withHealthStatus(row) : null;
}

export async function createSource(data: CreateSource) {
  const rows = await db.insert(newsSources).values(data).returning();
  return withHealthStatus(rows[0]);
}

export async function updateSource(id: number, data: UpdateSource) {
  const rows = await db
    .update(newsSources)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(newsSources.id, id))
    .returning();
  const row = rows[0] ?? null;
  return row ? withHealthStatus(row) : null;
}

export async function toggleSource(id: number) {
  // Haetaan nykyinen tila ensin
  const current = await getSource(id);
  if (!current) return null;

  const rows = await db
    .update(newsSources)
    .set({ isActive: !current.isActive, updatedAt: new Date() })
    .where(eq(newsSources.id, id))
    .returning();
  const row = rows[0] ?? null;
  return row ? withHealthStatus(row) : null;
}
