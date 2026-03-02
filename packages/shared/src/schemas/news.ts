import { z } from 'zod';

// Manuaalinen uutisen lisays -- admin syottaa URL:n, otsikko ja tiivistelma valinnaisia
export const createNewsItemSchema = z.object({
  url: z.string().url('URL on pakollinen'),
  title: z.string().optional(),
  summary: z.string().optional(),
});

// Uutisvastauksen skeema
export const newsItemResponseSchema = z.object({
  id: z.number(),
  sourceId: z.number().nullable(),
  title: z.string(),
  url: z.string(),
  summary: z.string().nullable(),
  content: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  collectedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});

// Keruutuloksen skeema
export const collectionResultSchema = z.object({
  collected: z.number(),
  errors: z.number(),
  sources: z.number(),
});

// Tyyppien vienti
export type CreateNewsItem = z.infer<typeof createNewsItemSchema>;
export type NewsItemResponse = z.infer<typeof newsItemResponseSchema>;
export type CollectionResult = z.infer<typeof collectionResultSchema>;
