import { z } from 'zod/v4';
import {
  createClientSchema,
  updateClientSchema,
  clientResponseSchema,
} from '../schemas/client.js';
import {
  createSourceSchema,
  updateSourceSchema,
  sourceResponseSchema,
} from '../schemas/source.js';
import {
  updateTemplateSchema,
  templateResponseSchema,
} from '../schemas/template.js';

// Asiakastyypit
export type CreateClient = z.infer<typeof createClientSchema>;
export type UpdateClient = z.infer<typeof updateClientSchema>;
export type ClientResponse = z.infer<typeof clientResponseSchema>;

// Uutislähdetyypit
export type CreateSource = z.infer<typeof createSourceSchema>;
export type UpdateSource = z.infer<typeof updateSourceSchema>;
export type SourceResponse = z.infer<typeof sourceResponseSchema>;

// Kehotepohjatyypit
export type UpdateTemplate = z.infer<typeof updateTemplateSchema>;
export type TemplateResponse = z.infer<typeof templateResponseSchema>;
