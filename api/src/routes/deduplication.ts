import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  getDuplicates,
  overrideDuplicate,
  processNewEmbeddings,
} from '../services/deduplicationService.js';

const deduplicationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /deduplication -- palauttaa merkityt duplikaatit kanonisten uutisten kanssa
  f.route({
    method: 'GET',
    url: '/deduplication',
    onRequest: [fastify.authenticate],
    schema: {
      querystring: z.object({
        limit: z.coerce.number().min(1).max(500).default(100),
      }),
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            title: z.string(),
            url: z.string(),
            collectedAt: z.coerce.date(),
            canonicalItemId: z.number().nullable(),
            canonicalTitle: z.string().nullable(),
            canonicalUrl: z.string().nullable(),
            similarity: z.number().nullable(),
          })
        ),
      },
    },
    handler: async (request, reply) => {
      const { limit } = request.query;
      const duplicates = await getDuplicates(limit);
      return reply.code(200).send(duplicates);
    },
  });

  // POST /deduplication/:itemId/override -- poistaa vaarin tunnistetun duplikaattimerkinnon
  f.route({
    method: 'POST',
    url: '/deduplication/:itemId/override',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ itemId: z.coerce.number() }),
      response: {
        200: z.object({ success: z.boolean() }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { itemId } = request.params;
      const success = await overrideDuplicate(itemId);

      if (!success) {
        return reply.code(404).send({ error: 'Uutista ei loytynyt' });
      }

      return reply.code(200).send({ success: true });
    },
  });

  // POST /deduplication/process -- kaynnistaa embedding-generoinnin ja duplikaattien tunnistuksen manuaalisesti
  f.route({
    method: 'POST',
    url: '/deduplication/process',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.object({
          embedded: z.number(),
          duplicatesFound: z.number(),
        }),
      },
    },
    handler: async (_request, reply) => {
      const result = await processNewEmbeddings();
      return reply.code(200).send(result);
    },
  });
};

export default deduplicationRoutes;
