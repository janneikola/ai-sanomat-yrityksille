import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createNewsItemSchema,
  newsItemResponseSchema,
  collectionResultSchema,
} from '@ai-sanomat/shared';
import { db } from '../db/index.js';
import { newsItems } from '../db/schema.js';
import { triggerCollection } from '../scheduler.js';

const newsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /news -- listaa uutiset, uusimmat ensin
  f.route({
    method: 'GET',
    url: '/news',
    onRequest: [fastify.authenticate],
    schema: {
      querystring: z.object({
        limit: z.coerce.number().min(1).max(500).default(100),
      }),
      response: {
        200: z.array(newsItemResponseSchema),
      },
    },
    handler: async (request, reply) => {
      const { limit } = request.query;
      const items = await db
        .select()
        .from(newsItems)
        .orderBy(desc(newsItems.collectedAt))
        .limit(limit);
      return reply.code(200).send(items);
    },
  });

  // POST /news -- manuaalinen uutisen lisays
  f.route({
    method: 'POST',
    url: '/news',
    onRequest: [fastify.authenticate],
    schema: {
      body: createNewsItemSchema,
      response: {
        201: newsItemResponseSchema,
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { url, title, summary } = request.body;

      // Kaytetaan URL:a otsikkona jos otsikkoa ei annettu
      const itemTitle = title || url;

      const result = await db
        .insert(newsItems)
        .values({
          sourceId: null, // Manuaalinen lisays -- ei lahdetta
          title: itemTitle,
          url,
          summary: summary ?? null,
        })
        .onConflictDoNothing()
        .returning();

      if (result.length === 0) {
        return reply.code(200).send({ message: 'Uutinen on jo lisatty' });
      }

      return reply.code(201).send(result[0]);
    },
  });

  // POST /news/collect -- kaynnista manuaalinen keruuajo
  f.route({
    method: 'POST',
    url: '/news/collect',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: collectionResultSchema,
      },
    },
    handler: async (_request, reply) => {
      const result = await triggerCollection();
      return reply.code(200).send(result);
    },
  });

  // DELETE /news/:id -- poista uutinen
  f.route({
    method: 'DELETE',
    url: '/news/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
    },
    handler: async (request, reply) => {
      await db.delete(newsItems).where(eq(newsItems.id, request.params.id));
      return reply.code(204).send();
    },
  });
};

export default newsRoutes;
