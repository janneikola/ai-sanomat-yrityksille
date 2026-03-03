/**
 * X/Twitter-budjetin seuranta ja kustannusarviointi.
 * Seuraa Apify-kustannuksia per ajo ja kuukausi.
 * Budjettikatto on pehmea -- varoittaa 80% ja 100% kohdalla mutta ei esta hakemista.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { xBudgetUsage } from '../db/schema.js';

// Apify Tweet Scraper V2: $0.40 per 1,000 tweets (pay-per-result)
const COST_PER_1000_TWEETS = 0.40;

// Budget warning threshold: 80%
const WARNING_THRESHOLD = 0.80;

type WarningLevel = 'none' | 'warning' | 'exceeded';

function estimateCost(tweetCount: number): number {
  return (tweetCount / 1000) * COST_PER_1000_TWEETS;
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}

function getBudgetLimit(): number {
  return Number(process.env.X_MONTHLY_BUDGET ?? '50');
}

/**
 * Tallentaa yhden Apify-ajon kustannusarvion tietokantaan.
 */
export async function recordBudgetUsage(
  runType: 'influencer' | 'search',
  sourceId: number,
  tweetsCollected: number
): Promise<void> {
  const cost = estimateCost(tweetsCollected);

  await db.insert(xBudgetUsage).values({
    month: getCurrentMonth(),
    estimatedCost: cost,
    tweetsCollected,
    runType,
    sourceId,
  });
}

/**
 * Tarkistaa kuukauden budjettitilanteen.
 * warningLevel: 'warning' >= 80%, 'exceeded' >= 100%
 */
export async function checkBudget(): Promise<{
  spent: number;
  limit: number;
  remaining: number;
  warningLevel: WarningLevel;
}> {
  const currentMonth = getCurrentMonth();
  const limit = getBudgetLimit();

  const [usage] = await db
    .select({ total: sql<number>`coalesce(sum(${xBudgetUsage.estimatedCost}), 0)` })
    .from(xBudgetUsage)
    .where(eq(xBudgetUsage.month, currentMonth));

  const spent = Number(usage?.total ?? 0);
  const remaining = limit - spent;

  let warningLevel: WarningLevel = 'none';
  if (spent >= limit) {
    warningLevel = 'exceeded';
    console.warn(`X budget exceeded: $${spent.toFixed(2)}/$${limit} (${((spent / limit) * 100).toFixed(0)}%)`);
  } else if (spent >= limit * WARNING_THRESHOLD) {
    warningLevel = 'warning';
    console.warn(`X budget warning: $${spent.toFixed(2)}/$${limit} (${((spent / limit) * 100).toFixed(0)}%)`);
  }

  return { spent, limit, remaining, warningLevel };
}

/**
 * Palauttaa budjettiyhteenvedon: nykyinen kuukausi + 6 kuukauden historia.
 */
export async function getBudgetSummary(): Promise<{
  currentMonth: {
    spent: number;
    limit: number;
    remaining: number;
    warningLevel: WarningLevel;
    tweetsCollected: number;
  };
  history: Array<{
    month: string;
    spent: number;
    tweetsCollected: number;
  }>;
}> {
  const currentMonth = getCurrentMonth();
  const budgetStatus = await checkBudget();

  // Nykyisen kuukauden twiittien maara
  const [currentTweets] = await db
    .select({ total: sql<number>`coalesce(sum(${xBudgetUsage.tweetsCollected}), 0)` })
    .from(xBudgetUsage)
    .where(eq(xBudgetUsage.month, currentMonth));

  // Viimeisen 6 kuukauden historia
  const historyRows = await db
    .select({
      month: xBudgetUsage.month,
      spent: sql<number>`coalesce(sum(${xBudgetUsage.estimatedCost}), 0)`,
      tweetsCollected: sql<number>`coalesce(sum(${xBudgetUsage.tweetsCollected}), 0)`,
    })
    .from(xBudgetUsage)
    .groupBy(xBudgetUsage.month)
    .orderBy(sql`${xBudgetUsage.month} desc`)
    .limit(7); // current + 6 previous

  // Suodata nykyinen kuukausi pois historiasta
  const history = historyRows
    .filter((r) => r.month !== currentMonth)
    .slice(0, 6)
    .map((r) => ({
      month: r.month,
      spent: Number(r.spent),
      tweetsCollected: Number(r.tweetsCollected),
    }));

  return {
    currentMonth: {
      ...budgetStatus,
      tweetsCollected: Number(currentTweets?.total ?? 0),
    },
    history,
  };
}
