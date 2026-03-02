import { z } from 'zod/v4';

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
});

export const clientResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  industry: z.string(),
  contactEmail: z.string(),
  contactName: z.string().nullable(),
  plan: z.enum(['ai_pulse', 'ai_teams']),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
