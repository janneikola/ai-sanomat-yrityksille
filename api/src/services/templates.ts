import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { promptTemplates } from '../db/schema.js';
import type { UpdateTemplate } from '@ai-sanomat/shared';

export async function listTemplates() {
  return db.select().from(promptTemplates).orderBy(asc(promptTemplates.name));
}

export async function getTemplate(id: number) {
  const rows = await db.select().from(promptTemplates).where(eq(promptTemplates.id, id));
  return rows[0] ?? null;
}

export async function updateTemplate(id: number, data: UpdateTemplate) {
  const rows = await db
    .update(promptTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(promptTemplates.id, id))
    .returning();
  return rows[0] ?? null;
}
