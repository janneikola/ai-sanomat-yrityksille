import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients } from '../db/schema.js';
import type { CreateClient, UpdateClient } from '@ai-sanomat/shared';

export async function listClients() {
  return db.select().from(clients).orderBy(clients.createdAt);
}

export async function getClient(id: number) {
  const rows = await db.select().from(clients).where(eq(clients.id, id));
  return rows[0] ?? null;
}

export async function createClient(data: CreateClient) {
  const rows = await db.insert(clients).values(data).returning();
  return rows[0];
}

export async function updateClient(id: number, data: UpdateClient) {
  const rows = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return rows[0] ?? null;
}
