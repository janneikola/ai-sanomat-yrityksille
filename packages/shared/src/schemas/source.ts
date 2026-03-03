import { z } from 'zod';

export const createSourceSchema = z.object({
  name: z.string().min(1, 'Nimi on pakollinen'),
  type: z.enum(['rss', 'beehiiv', 'manual', 'web_search']),
  url: z.string().optional(),
  config: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(['rss', 'beehiiv', 'manual', 'web_search']).optional(),
  url: z.string().optional(),
  config: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const sourceResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.enum(['rss', 'beehiiv', 'manual', 'web_search']),
  url: z.string().nullable(),
  config: z.string().nullable(),
  isActive: z.boolean(),
  // Health tracking fields
  consecutiveFailures: z.number(),
  lastSuccessAt: z.coerce.date().nullable(),
  lastItemCount: z.number().nullable(),
  healthStatus: z.enum(['green', 'yellow', 'red']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
