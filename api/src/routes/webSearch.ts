import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../db/index.js';
import { clients, searchCache } from '../db/schema.js';
import { searchForClient } from '../services/webSearchService.js';

const webSearchRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /web-search/clients -- palauttaa kaikki asiakkaat verkkohakutiedoilla
  f.route({
    method: 'GET',
    url: '/web-search/clients',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            industry: z.string(),
            webSearchEnabled: z.boolean(),
            searchPrompt: z.string().nullable(),
            lastWebSearchAt: z.coerce.date().nullable(),
            recentResults: z.array(
              z.object({
                id: z.number(),
                query: z.string(),
                resultCount: z.number(),
                cachedAt: z.coerce.date(),
                results: z.string(),
              })
            ),
          })
        ),
      },
    },
    handler: async (_request, reply) => {
      const allClients = await db
        .select()
        .from(clients)
        .orderBy(clients.name);

      const result = await Promise.all(
        allClients.map(async (client) => {
          const recentCache = await db
            .select()
            .from(searchCache)
            .where(eq(searchCache.clientId, client.id))
            .orderBy(desc(searchCache.cachedAt))
            .limit(5);

          return {
            id: client.id,
            name: client.name,
            industry: client.industry,
            webSearchEnabled: client.webSearchEnabled,
            searchPrompt: client.searchPrompt,
            lastWebSearchAt: client.lastWebSearchAt,
            recentResults: recentCache.map((c) => ({
              id: c.id,
              query: c.query,
              resultCount: c.resultCount,
              cachedAt: c.cachedAt,
              results: c.results,
            })),
          };
        })
      );

      return reply.code(200).send(result);
    },
  });

  // POST /web-search/:clientId/trigger -- kaynnistaa verkkohaun asiakkaalle
  f.route({
    method: 'POST',
    url: '/web-search/:clientId/trigger',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ clientId: z.coerce.number() }),
      response: {
        200: z.object({
          collected: z.number(),
          queries: z.number(),
          cached: z.number(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { clientId } = request.params;

      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId));

      if (!client) {
        return reply.code(404).send({ error: 'Asiakasta ei loydy' });
      }

      const result = await searchForClient(clientId);
      return reply.code(200).send(result);
    },
  });

  // PUT /web-search/:clientId/config -- paivittaa asiakkaan verkkohakuasetukset
  f.route({
    method: 'PUT',
    url: '/web-search/:clientId/config',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ clientId: z.coerce.number() }),
      body: z.object({
        webSearchEnabled: z.boolean().optional(),
        searchPrompt: z.string().nullable().optional(),
      }),
      response: {
        200: z.object({
          id: z.number(),
          name: z.string(),
          industry: z.string(),
          webSearchEnabled: z.boolean(),
          searchPrompt: z.string().nullable(),
          lastWebSearchAt: z.coerce.date().nullable(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { clientId } = request.params;
      const { webSearchEnabled, searchPrompt } = request.body;

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (webSearchEnabled !== undefined) updateData.webSearchEnabled = webSearchEnabled;
      if (searchPrompt !== undefined) updateData.searchPrompt = searchPrompt;

      const [updated] = await db
        .update(clients)
        .set(updateData)
        .where(eq(clients.id, clientId))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: 'Asiakasta ei loydy' });
      }

      return reply.code(200).send({
        id: updated.id,
        name: updated.name,
        industry: updated.industry,
        webSearchEnabled: updated.webSearchEnabled,
        searchPrompt: updated.searchPrompt,
        lastWebSearchAt: updated.lastWebSearchAt,
      });
    },
  });
};

export default webSearchRoutes;
