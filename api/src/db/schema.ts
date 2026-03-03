import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';

// Enumeraatiot
export const sourceTypeEnum = pgEnum('source_type', ['rss', 'beehiiv', 'manual', 'web_search']);
export const planEnum = pgEnum('plan', ['ai_pulse', 'ai_teams']);
export const issueStatusEnum = pgEnum('issue_status', [
  'draft',
  'generating',
  'validating',
  'ready',
  'approved',
  'sent',
  'failed',
]);
export const deliveryStatusEnum = pgEnum('delivery_status', [
  'sent',
  'delivered',
  'opened',
  'bounced',
  'failed',
]);

export const scheduleFrequencyEnum = pgEnum('schedule_frequency', ['weekly', 'biweekly', 'monthly']);
export const voteTypeEnum = pgEnum('vote_type', ['up', 'down']);

// Asiakkaat
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 100 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }),
  plan: planEnum('plan').notNull().default('ai_pulse'),
  isActive: boolean('is_active').notNull().default(true),
  // Schedule columns
  scheduleFrequency: scheduleFrequencyEnum('schedule_frequency').notNull().default('weekly'),
  scheduleDay: integer('schedule_day').notNull().default(1), // 0=Sun..6=Sat, default Monday
  scheduleBiweeklyWeek: varchar('schedule_biweekly_week', { length: 4 }), // 'even' | 'odd' | null
  schedulePaused: boolean('schedule_paused').notNull().default(true), // default paused
  // Web search columns
  webSearchEnabled: boolean('web_search_enabled').notNull().default(false),
  searchPrompt: text('search_prompt'), // nullable -- null means auto-generate from industry
  lastWebSearchAt: timestamp('last_web_search_at'), // nullable
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Asiakkaiden jäsenet (uutiskirjeen vastaanottajat)
export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  isActive: boolean('is_active').notNull().default(true),
  isBounced: boolean('is_bounced').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Uutislähteet (RSS, Beehiiv, manuaalinen)
export const newsSources = pgTable('news_sources', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: sourceTypeEnum('type').notNull(),
  url: text('url'),
  config: text('config'), // JSON-merkkijono tyyppikohtaiselle konfiguraatiolle (esim. Beehiiv publication ID)
  isActive: boolean('is_active').notNull().default(true),
  // Health tracking columns
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  lastSuccessAt: timestamp('last_success_at'),
  lastItemCount: integer('last_item_count'),
  lastItemsAt: timestamp('last_items_at'), // updated only when items > 0, used for stale detection
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Kerätyt uutisartikkelit
export const newsItems = pgTable('news_items', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').references(() => newsSources.id),
  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  summary: text('summary'),
  content: text('content'),
  publishedAt: timestamp('published_at'),
  collectedAt: timestamp('collected_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Viikkokatsaukset
export const issues = pgTable('issues', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  periodNumber: integer('period_number'), // nullable for backward compat; new issues always set it
  status: issueStatusEnum('status').notNull().default('draft'),
  generatedContent: text('generated_content'),
  validationReport: text('validation_report'),
  heroImageUrl: text('hero_image_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Lähetystilastot
export const deliveryStats = pgTable('delivery_stats', {
  id: serial('id').primaryKey(),
  issueId: integer('issue_id')
    .notNull()
    .references(() => issues.id),
  memberId: integer('member_id')
    .notNull()
    .references(() => members.id),
  status: deliveryStatusEnum('status').notNull().default('sent'),
  resendMessageId: text('resend_message_id'),
  sentAt: timestamp('sent_at'),
  openedAt: timestamp('opened_at'),
  bouncedAt: timestamp('bounced_at'),
});

// Ajastettujen ajojen loki
export const schedulerRuns = pgTable('scheduler_runs', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  clientsProcessed: integer('clients_processed').notNull().default(0),
  successes: integer('successes').notNull().default(0),
  failures: integer('failures').notNull().default(0),
  skips: integer('skips').notNull().default(0),
  notes: text('notes'), // JSON string with per-client results
});

// Uutislahteiden terveysloki
export const sourceHealthLogs = pgTable('source_health_logs', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').notNull().references(() => newsSources.id),
  success: boolean('success').notNull(),
  itemCount: integer('item_count').notNull().default(0),
  errorMessage: text('error_message'),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
});

// Kehotepohjat
export const promptTemplates = pgTable('prompt_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: text('description'),
  template: text('template').notNull(),
  variables: text('variables'), // JSON-taulukko käytettävistä muuttujanimistä
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

// Lukijapalaute (thumbs up/down aanestys per jasen per katsaus)
export const feedbackVotes = pgTable('feedback_votes', {
  id: serial('id').primaryKey(),
  memberId: integer('member_id').notNull().references(() => members.id),
  issueId: integer('issue_id').notNull().references(() => issues.id),
  vote: voteTypeEnum('vote').notNull(),
  votedAt: timestamp('voted_at').notNull().defaultNow(),
}, (table) => [
  unique().on(table.memberId, table.issueId),
]);

// Verkkohakujen valimuisti (24h TTL)
export const searchCache = pgTable('search_cache', {
  id: serial('id').primaryKey(),
  queryHash: varchar('query_hash', { length: 255 }).notNull(),
  query: text('query').notNull(),
  clientId: integer('client_id').references(() => clients.id),
  results: text('results').notNull(), // JSON string of TavilyResult[]
  resultCount: integer('result_count').notNull().default(0),
  cachedAt: timestamp('cached_at').notNull().defaultNow(),
});
