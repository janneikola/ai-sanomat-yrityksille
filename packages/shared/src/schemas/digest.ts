import { z } from 'zod';

export const aiPatternFlagSchema = z.object({
  patternId: z.number(),
  patternName: z.string(),
  example: z.string(),
  suggestion: z.string(),
});

export const digestStorySchema = z.object({
  title: z.string(),
  businessImpact: z.string(),
  sourceUrl: z.string(),
  imageUrl: z.string().optional(),
});

export const digestContentSchema = z.object({
  intro: z.string(),
  stories: z.array(digestStorySchema),
  closing: z.string(),
});

export const validationReportSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  languageQuality: z.object({
    score: z.number(),
    aiPatternFlags: z.array(aiPatternFlagSchema),
  }),
});

export const digestResponseSchema = z.object({
  id: z.number(),
  clientId: z.number(),
  weekNumber: z.number(),
  year: z.number(),
  status: z.string(),
  generatedContent: digestContentSchema.nullable(),
  validationReport: validationReportSchema.nullable(),
  heroImageUrl: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DigestStory = z.infer<typeof digestStorySchema>;
export type DigestContent = z.infer<typeof digestContentSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;
export type DigestResponse = z.infer<typeof digestResponseSchema>;
