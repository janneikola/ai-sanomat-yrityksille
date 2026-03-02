import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enumeraatiot
export const sourceTypeEnum = pgEnum('source_type', ['rss', 'beehiiv', 'manual']);
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

// Asiakkaat
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  industry: varchar('industry', { length: 100 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }),
  plan: planEnum('plan').notNull().default('ai_pulse'),
  isActive: boolean('is_active').notNull().default(true),
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
