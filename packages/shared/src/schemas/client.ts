import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1, 'Nimi on pakollinen'),
  industry: z.string().min(1, 'Toimiala on pakollinen'),
  contactEmail: z.string().email('Virheellinen sähköpostiosoite'),
  contactName: z.string().optional(),
  plan: z.enum(['ai_pulse', 'ai_teams']).default('ai_pulse'),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  contactName: z.string().optional(),
  plan: z.enum(['ai_pulse', 'ai_teams']).optional(),
  isActive: z.boolean().optional(),
  // Schedule fields
  scheduleFrequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  scheduleDay: z.number().int().min(0).max(6).optional(),
  scheduleBiweeklyWeek: z.enum(['even', 'odd']).nullable().optional(),
  schedulePaused: z.boolean().optional(),
  // Web search fields
  webSearchEnabled: z.boolean().optional(),
  searchPrompt: z.string().nullable().optional(),
});

export const clientResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  industry: z.string(),
  contactEmail: z.string(),
  contactName: z.string().nullable(),
  plan: z.enum(['ai_pulse', 'ai_teams']),
  isActive: z.boolean(),
  // Schedule fields
  scheduleFrequency: z.enum(['weekly', 'biweekly', 'monthly']),
  scheduleDay: z.number(),
  scheduleBiweeklyWeek: z.string().nullable(),
  schedulePaused: z.boolean(),
  nextScheduledDate: z.string().nullable(),
  // Web search fields
  webSearchEnabled: z.boolean(),
  searchPrompt: z.string().nullable(),
  lastWebSearchAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
