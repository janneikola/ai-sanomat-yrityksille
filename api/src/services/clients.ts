import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients } from '../db/schema.js';
import { getNextScheduledDate } from './scheduleService.js';
import type { CreateClient, UpdateClient } from '@ai-sanomat/shared';

export async function listClients() {
  const rows = await db.select().from(clients).orderBy(clients.createdAt);
  return rows.map((row) => ({
    ...row,
    nextScheduledDate: row.schedulePaused
      ? null
      : getNextScheduledDate(
          row.scheduleFrequency,
          row.scheduleDay,
          row.scheduleBiweeklyWeek
        ).toISOString(),
  }));
}

export async function getClient(id: number) {
  const rows = await db.select().from(clients).where(eq(clients.id, id));
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    nextScheduledDate: row.schedulePaused
      ? null
      : getNextScheduledDate(
          row.scheduleFrequency,
          row.scheduleDay,
          row.scheduleBiweeklyWeek
        ).toISOString(),
  };
}

export async function createClient(data: CreateClient) {
  const rows = await db.insert(clients).values(data).returning();
  const row = rows[0];
  return {
    ...row,
    nextScheduledDate: row.schedulePaused
      ? null
      : getNextScheduledDate(
          row.scheduleFrequency,
          row.scheduleDay,
          row.scheduleBiweeklyWeek
        ).toISOString(),
  };
}

export async function updateClient(id: number, data: UpdateClient) {
  const rows = await db
    .update(clients)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    nextScheduledDate: row.schedulePaused
      ? null
      : getNextScheduledDate(
          row.scheduleFrequency,
          row.scheduleDay,
          row.scheduleBiweeklyWeek
        ).toISOString(),
  };
}

export async function updateClientSchedule(
  id: number,
  scheduleData: {
    scheduleFrequency?: 'weekly' | 'biweekly' | 'monthly';
    scheduleDay?: number;
    scheduleBiweeklyWeek?: string | null;
    schedulePaused?: boolean;
  }
) {
  const rows = await db
    .update(clients)
    .set({ ...scheduleData, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  const row = rows[0] ?? null;
  if (!row) return null;
  return {
    ...row,
    nextScheduledDate: row.schedulePaused
      ? null
      : getNextScheduledDate(
          row.scheduleFrequency,
          row.scheduleDay,
          row.scheduleBiweeklyWeek
        ).toISOString(),
  };
}
