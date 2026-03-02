import { z } from 'zod';

export const updateTemplateSchema = z.object({
  description: z.string().optional(),
  template: z.string().min(1, 'Kehottepohja on pakollinen'),
  variables: z.string().optional(),
});

export const templateResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  template: z.string(),
  variables: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
