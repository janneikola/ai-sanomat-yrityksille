import { sql } from 'drizzle-orm';
import { db } from './index.js';

/**
 * Aktivoi pgvector-laajennuksen PostgreSQL-tietokannassa.
 * Tama taytyy ajaa ennen drizzle-kit push -komentoa,
 * jotta vector-saraketyyppi tunnistetaan.
 */
export async function enablePgvector(): Promise<void> {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log('pgvector extension enabled successfully');
  } catch (error) {
    console.error('Failed to enable pgvector extension:', error);
    throw error;
  }
}

// Suorita suoraan komentorivilta: npx tsx src/db/enablePgvector.ts
if (process.argv[1]?.endsWith('enablePgvector.ts')) {
  enablePgvector()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
