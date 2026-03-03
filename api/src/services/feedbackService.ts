import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { feedbackVotes, issues, clients } from '../db/schema.js';

// --- Types ---

export interface SatisfactionResult {
  totalVotes: number;
  thumbsUp: number;
  thumbsDown: number;
  satisfaction: number | null;
  flagged: boolean;
}

export interface SatisfactionByIssue {
  issueId: number;
  clientId: number;
  clientName: string;
  issueDate: string;
  totalVotes: number;
  thumbsUp: number;
  thumbsDown: number;
  satisfaction: number | null;
  flagged: boolean;
}

export interface SatisfactionByClient {
  clientId: number;
  clientName: string;
  totalVotes: number;
  thumbsUp: number;
  thumbsDown: number;
  satisfaction: number | null;
}

// --- Pure functions ---

/**
 * Laskee tyytyväisyysprosentin ja flaggauksen.
 * Puhdas funktio -- testattavissa ilman tietokantaa.
 */
export function computeSatisfaction(
  thumbsUp: number,
  thumbsDown: number
): SatisfactionResult {
  const totalVotes = thumbsUp + thumbsDown;

  if (totalVotes === 0) {
    return { totalVotes: 0, thumbsUp: 0, thumbsDown: 0, satisfaction: null, flagged: false };
  }

  const satisfaction = Math.round((thumbsUp / totalVotes) * 100);
  const flagged = totalVotes >= 3 && satisfaction < 50;

  return { totalVotes, thumbsUp, thumbsDown, satisfaction, flagged };
}

// --- URL generation ---

/**
 * Generoi per-jasen JWT-allekirjoitetut palaute-URL:t.
 * Tokenissa on memberId, issueId, vote ja purpose='feedback' 90 paivaen voimassaoloajalla.
 */
export function generateFeedbackUrls(
  app: FastifyInstance,
  memberId: number,
  issueId: number
): { up: string; down: string } {
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

  // Feedback tokens have different payload shape than auth tokens.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sign = app.jwt.sign as (payload: any, options?: any) => string;

  const upToken = sign(
    { memberId, issueId, vote: 'up', purpose: 'feedback' },
    { expiresIn: '90d' }
  );

  const downToken = sign(
    { memberId, issueId, vote: 'down', purpose: 'feedback' },
    { expiresIn: '90d' }
  );

  return {
    up: `${baseUrl}/api/feedback/vote?token=${upToken}`,
    down: `${baseUrl}/api/feedback/vote?token=${downToken}`,
  };
}

// --- Database operations ---

/**
 * Kirjaa aanestyksen. UPSERT: paivittaa olemassaolevan tai lisaa uuden.
 * UNIQUE(memberId, issueId) takaa etta jasenella on yksi aanestys per katsaus.
 */
export async function recordVote(
  memberId: number,
  issueId: number,
  vote: 'up' | 'down'
): Promise<void> {
  await db
    .insert(feedbackVotes)
    .values({ memberId, issueId, vote, votedAt: new Date() })
    .onConflictDoUpdate({
      target: [feedbackVotes.memberId, feedbackVotes.issueId],
      set: { vote, votedAt: new Date() },
    });
}

/**
 * Hakee tyytyväisyystiedot katsauskohtaisesti.
 * Palauttaa taulun järjestettynä viimeisimmästä ensimmaiseksi.
 */
export async function getSatisfactionByIssue(): Promise<SatisfactionByIssue[]> {
  const rows = await db
    .select({
      issueId: feedbackVotes.issueId,
      clientId: issues.clientId,
      clientName: clients.name,
      issueDate: sql<string>`${issues.createdAt}::text`,
      thumbsUp: sql<number>`count(case when ${feedbackVotes.vote} = 'up' then 1 end)::int`,
      thumbsDown: sql<number>`count(case when ${feedbackVotes.vote} = 'down' then 1 end)::int`,
    })
    .from(feedbackVotes)
    .innerJoin(issues, eq(feedbackVotes.issueId, issues.id))
    .innerJoin(clients, eq(issues.clientId, clients.id))
    .groupBy(feedbackVotes.issueId, issues.clientId, clients.name, issues.createdAt)
    .orderBy(sql`${issues.createdAt} DESC`);

  return rows.map((row) => {
    const sat = computeSatisfaction(row.thumbsUp, row.thumbsDown);
    return {
      issueId: row.issueId,
      clientId: row.clientId,
      clientName: row.clientName,
      issueDate: row.issueDate,
      totalVotes: sat.totalVotes,
      thumbsUp: sat.thumbsUp,
      thumbsDown: sat.thumbsDown,
      satisfaction: sat.satisfaction,
      flagged: sat.flagged,
    };
  });
}

/**
 * Hakee tyytyväisyystiedot asiakaskohtaisesti (aggregaatti kaikista katsauksista).
 */
export async function getSatisfactionByClient(): Promise<SatisfactionByClient[]> {
  const rows = await db
    .select({
      clientId: issues.clientId,
      clientName: clients.name,
      thumbsUp: sql<number>`count(case when ${feedbackVotes.vote} = 'up' then 1 end)::int`,
      thumbsDown: sql<number>`count(case when ${feedbackVotes.vote} = 'down' then 1 end)::int`,
    })
    .from(feedbackVotes)
    .innerJoin(issues, eq(feedbackVotes.issueId, issues.id))
    .innerJoin(clients, eq(issues.clientId, clients.id))
    .groupBy(issues.clientId, clients.name);

  return rows.map((row) => {
    const sat = computeSatisfaction(row.thumbsUp, row.thumbsDown);
    return {
      clientId: row.clientId,
      clientName: row.clientName,
      totalVotes: sat.totalVotes,
      thumbsUp: sat.thumbsUp,
      thumbsDown: sat.thumbsDown,
      satisfaction: sat.satisfaction,
    };
  });
}
