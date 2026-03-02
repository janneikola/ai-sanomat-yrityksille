import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsSources } from '../db/schema.js';
import type { CreateSource, UpdateSource } from '@ai-sanomat/shared';

export async function listSources() {
  return db.select().from(newsSources).orderBy(newsSources.createdAt);
}

export async function getSource(id: number) {
  const rows = await db.select().from(newsSources).where(eq(newsSources.id, id));
  return rows[0] ?? null;
}

export async function createSource(data: CreateSource) {
  const rows = await db.insert(newsSources).values(data).returning();
  return rows[0];
}

export async function updateSource(id: number, data: UpdateSource) {
  const rows = await db
    .update(newsSources)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(newsSources.id, id))
    .returning();
  return rows[0] ?? null;
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
  return rows[0] ?? null;
}
