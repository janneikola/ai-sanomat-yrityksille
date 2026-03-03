/**
 * X/Twitter-seurannan admin-reitit.
 * CRUD x_account- ja x_search-lahteille + budjettiyhteenveto + manuaalinen kaynnistys.
 * Kaikki reitit vaativat admin-autentikoinnin.
 */

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../db/index.js';
import { newsSources, clients } from '../db/schema.js';
import { computeHealthStatus } from '../services/sourceHealthService.js';
import { getBudgetSummary } from '../services/xBudgetService.js';
import { collectXAccounts } from '../services/xCollectorService.js';

const xMonitoringRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // --- X Account (influensseri) -reitit ---

  // GET /x-monitoring/accounts -- Listaa kaikki x_account-lahteet terveystiedoilla
  f.route({
    method: 'GET',
    url: '/x-monitoring/accounts',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            config: z.object({
              handle: z.string(),
              description: z.string().optional(),
              includeReplies: z.boolean().optional(),
              minLikes: z.number().optional(),
            }),
            isActive: z.boolean(),
            healthStatus: z.enum(['green', 'yellow', 'red']),
            lastSuccessAt: z.coerce.date().nullable(),
            lastItemCount: z.number().nullable(),
            createdAt: z.coerce.date(),
          })
        ),
      },
    },
    handler: async (_request, reply) => {
      const sources = await db
        .select()
        .from(newsSources)
        .where(eq(newsSources.type, 'x_account'))
        .orderBy(newsSources.name);

      const result = sources.map((source) => {
        const config = source.config ? JSON.parse(source.config) : { handle: '' };
        return {
          id: source.id,
          name: source.name,
          config,
          isActive: source.isActive,
          healthStatus: computeHealthStatus({
            isActive: source.isActive,
            consecutiveFailures: source.consecutiveFailures,
            lastItemsAt: source.lastItemsAt,
            lastItemCount: source.lastItemCount,
          }),
          lastSuccessAt: source.lastSuccessAt,
          lastItemCount: source.lastItemCount,
          createdAt: source.createdAt,
        };
      });

      return reply.code(200).send(result);
    },
  });

  // POST /x-monitoring/accounts -- Luo uusi x_account-lahde
  f.route({
    method: 'POST',
    url: '/x-monitoring/accounts',
    onRequest: [fastify.authenticate],
    schema: {
      body: z.object({
        handle: z.string().min(1),
        description: z.string().optional(),
        includeReplies: z.boolean().optional(),
        minLikes: z.number().optional(),
      }),
      response: {
        201: z.object({
          id: z.number(),
          name: z.string(),
          type: z.string(),
          isActive: z.boolean(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { handle, description, includeReplies, minLikes } = request.body;

      const [created] = await db
        .insert(newsSources)
        .values({
          name: `X: @${handle}`,
          type: 'x_account',
          config: JSON.stringify({ handle, description, includeReplies, minLikes }),
          isActive: true,
        })
        .returning();

      return reply.code(201).send({
        id: created.id,
        name: created.name,
        type: created.type,
        isActive: created.isActive,
      });
    },
  });

  // PUT /x-monitoring/accounts/:id -- Paivita x_account-lahde
  f.route({
    method: 'PUT',
    url: '/x-monitoring/accounts/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({
        handle: z.string().optional(),
        description: z.string().optional(),
        includeReplies: z.boolean().optional(),
        minLikes: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
      response: {
        200: z.object({
          id: z.number(),
          name: z.string(),
          isActive: z.boolean(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const { handle, description, includeReplies, minLikes, isActive } = request.body;

      // Hae nykyinen konfiguraatio
      const [existing] = await db
        .select()
        .from(newsSources)
        .where(and(eq(newsSources.id, id), eq(newsSources.type, 'x_account')));

      if (!existing) {
        return reply.code(404).send({ error: 'X-tilia ei loydy' });
      }

      const currentConfig = existing.config ? JSON.parse(existing.config) : {};
      const updatedConfig = {
        ...currentConfig,
        ...(handle !== undefined && { handle }),
        ...(description !== undefined && { description }),
        ...(includeReplies !== undefined && { includeReplies }),
        ...(minLikes !== undefined && { minLikes }),
      };

      const updateData: Record<string, unknown> = {
        config: JSON.stringify(updatedConfig),
      };
      if (handle !== undefined) {
        updateData.name = `X: @${handle}`;
      }
      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }

      const [updated] = await db
        .update(newsSources)
        .set(updateData)
        .where(eq(newsSources.id, id))
        .returning();

      return reply.code(200).send({
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
      });
    },
  });

  // DELETE /x-monitoring/accounts/:id -- Poista x_account-lahde
  f.route({
    method: 'DELETE',
    url: '/x-monitoring/accounts/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        204: z.null(),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;

      const [existing] = await db
        .select()
        .from(newsSources)
        .where(and(eq(newsSources.id, id), eq(newsSources.type, 'x_account')));

      if (!existing) {
        return reply.code(404).send({ error: 'X-tilia ei loydy' });
      }

      await db
        .delete(newsSources)
        .where(eq(newsSources.id, id));

      return reply.code(204).send(null);
    },
  });

  // --- X Search (avainsanahaku) -reitit ---

  // GET /x-monitoring/searches -- Listaa kaikki x_search-lahteet
  f.route({
    method: 'GET',
    url: '/x-monitoring/searches',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            config: z.object({
              query: z.string(),
              language: z.string().optional(),
              clientId: z.number().optional(),
            }),
            clientName: z.string().nullable(),
            isActive: z.boolean(),
            healthStatus: z.enum(['green', 'yellow', 'red']),
            lastSuccessAt: z.coerce.date().nullable(),
            lastItemCount: z.number().nullable(),
          })
        ),
      },
    },
    handler: async (_request, reply) => {
      const sources = await db
        .select()
        .from(newsSources)
        .where(eq(newsSources.type, 'x_search'))
        .orderBy(newsSources.name);

      // Hae asiakkaiden nimet linkittamista varten
      const allClients = await db.select().from(clients);
      const clientMap = new Map(allClients.map((c) => [c.id, c.name]));

      const result = sources.map((source) => {
        const config = source.config ? JSON.parse(source.config) : { query: '' };
        return {
          id: source.id,
          name: source.name,
          config,
          clientName: config.clientId ? clientMap.get(config.clientId) ?? null : null,
          isActive: source.isActive,
          healthStatus: computeHealthStatus({
            isActive: source.isActive,
            consecutiveFailures: source.consecutiveFailures,
            lastItemsAt: source.lastItemsAt,
            lastItemCount: source.lastItemCount,
          }),
          lastSuccessAt: source.lastSuccessAt,
          lastItemCount: source.lastItemCount,
        };
      });

      return reply.code(200).send(result);
    },
  });

  // POST /x-monitoring/searches -- Luo uusi x_search-lahde
  f.route({
    method: 'POST',
    url: '/x-monitoring/searches',
    onRequest: [fastify.authenticate],
    schema: {
      body: z.object({
        query: z.string().min(1),
        language: z.string().optional(),
        clientId: z.number(),
      }),
      response: {
        201: z.object({
          id: z.number(),
          name: z.string(),
          type: z.string(),
          isActive: z.boolean(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { query, language, clientId } = request.body;

      const [created] = await db
        .insert(newsSources)
        .values({
          name: `X-haku: ${query}`,
          type: 'x_search',
          config: JSON.stringify({ query, language, clientId }),
          isActive: true,
        })
        .returning();

      return reply.code(201).send({
        id: created.id,
        name: created.name,
        type: created.type,
        isActive: created.isActive,
      });
    },
  });

  // PUT /x-monitoring/searches/:id -- Paivita x_search-lahde
  f.route({
    method: 'PUT',
    url: '/x-monitoring/searches/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({
        query: z.string().optional(),
        language: z.string().optional(),
        clientId: z.number().optional(),
        isActive: z.boolean().optional(),
      }),
      response: {
        200: z.object({
          id: z.number(),
          name: z.string(),
          isActive: z.boolean(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const { query, language, clientId, isActive } = request.body;

      const [existing] = await db
        .select()
        .from(newsSources)
        .where(and(eq(newsSources.id, id), eq(newsSources.type, 'x_search')));

      if (!existing) {
        return reply.code(404).send({ error: 'X-hakua ei loydy' });
      }

      const currentConfig = existing.config ? JSON.parse(existing.config) : {};
      const updatedConfig = {
        ...currentConfig,
        ...(query !== undefined && { query }),
        ...(language !== undefined && { language }),
        ...(clientId !== undefined && { clientId }),
      };

      const updateData: Record<string, unknown> = {
        config: JSON.stringify(updatedConfig),
      };
      if (query !== undefined) {
        updateData.name = `X-haku: ${query}`;
      }
      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }

      const [updated] = await db
        .update(newsSources)
        .set(updateData)
        .where(eq(newsSources.id, id))
        .returning();

      return reply.code(200).send({
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
      });
    },
  });

  // DELETE /x-monitoring/searches/:id -- Poista x_search-lahde
  f.route({
    method: 'DELETE',
    url: '/x-monitoring/searches/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        204: z.null(),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;

      const [existing] = await db
        .select()
        .from(newsSources)
        .where(and(eq(newsSources.id, id), eq(newsSources.type, 'x_search')));

      if (!existing) {
        return reply.code(404).send({ error: 'X-hakua ei loydy' });
      }

      await db
        .delete(newsSources)
        .where(eq(newsSources.id, id));

      return reply.code(204).send(null);
    },
  });

  // --- Budjetti ja manuaalinen kaynnistys ---

  // GET /x-monitoring/budget -- Budjettiyhteenveto
  f.route({
    method: 'GET',
    url: '/x-monitoring/budget',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.object({
          currentMonth: z.object({
            spent: z.number(),
            limit: z.number(),
            remaining: z.number(),
            warningLevel: z.enum(['none', 'warning', 'exceeded']),
            tweetsCollected: z.number(),
          }),
          history: z.array(
            z.object({
              month: z.string(),
              spent: z.number(),
              tweetsCollected: z.number(),
            })
          ),
        }),
      },
    },
    handler: async (_request, reply) => {
      const summary = await getBudgetSummary();
      return reply.code(200).send(summary);
    },
  });

  // POST /x-monitoring/trigger -- Manuaalinen kaynnistys (influensserit)
  f.route({
    method: 'POST',
    url: '/x-monitoring/trigger',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.object({
          collected: z.number(),
          errors: z.number(),
        }),
      },
    },
    handler: async (_request, reply) => {
      const result = await collectXAccounts();
      return reply.code(200).send(result);
    },
  });
};

export default xMonitoringRoutes;
