import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { updateTemplateSchema, templateResponseSchema } from '@ai-sanomat/shared';
import * as templateService from '../services/templates.js';

const templateRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /templates - listaa kaikki kehotepohjat
  f.route({
    method: 'GET',
    url: '/templates',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.array(templateResponseSchema),
      },
    },
    handler: async (_request, reply) => {
      const result = await templateService.listTemplates();
      return reply.code(200).send(result);
    },
  });

  // GET /templates/:id - hae yksittäinen kehottepohja
  f.route({
    method: 'GET',
    url: '/templates/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: templateResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const template = await templateService.getTemplate(request.params.id);
      if (!template) {
        return reply.code(404).send({ error: 'Kehotepohjaa ei löydy' });
      }
      return reply.code(200).send(template);
    },
  });

  // PUT /templates/:id - päivitä kehottepohja
  f.route({
    method: 'PUT',
    url: '/templates/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: updateTemplateSchema,
      response: {
        200: templateResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const template = await templateService.updateTemplate(request.params.id, request.body);
      if (!template) {
        return reply.code(404).send({ error: 'Kehotepohjaa ei löydy' });
      }
      return reply.code(200).send(template);
    },
  });
};

export default templateRoutes;
