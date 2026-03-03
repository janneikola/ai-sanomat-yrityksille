import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createSourceSchema,
  updateSourceSchema,
  sourceResponseSchema,
} from '@ai-sanomat/shared';
import * as sourceService from '../services/sources.js';

const sourceRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /sources - listaa kaikki uutislähteet (optionaalinen healthStatus-suodatus)
  f.route({
    method: 'GET',
    url: '/sources',
    onRequest: [fastify.authenticate],
    schema: {
      querystring: z.object({
        healthStatus: z.enum(['green', 'yellow', 'red']).optional(),
      }),
      response: {
        200: z.array(sourceResponseSchema),
      },
    },
    handler: async (request, reply) => {
      const result = await sourceService.listSources();
      const { healthStatus } = request.query;
      if (healthStatus) {
        const filtered = result.filter((s) => s.healthStatus === healthStatus);
        return reply.code(200).send(filtered);
      }
      return reply.code(200).send(result);
    },
  });

  // POST /sources - luo uusi uutislähde
  f.route({
    method: 'POST',
    url: '/sources',
    onRequest: [fastify.authenticate],
    schema: {
      body: createSourceSchema,
      response: {
        201: sourceResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const source = await sourceService.createSource(request.body);
      return reply.code(201).send(source);
    },
  });

  // GET /sources/:id - hae yksittäinen uutislähde
  f.route({
    method: 'GET',
    url: '/sources/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: sourceResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const source = await sourceService.getSource(request.params.id);
      if (!source) {
        return reply.code(404).send({ error: 'Uutislähdettä ei löydy' });
      }
      return reply.code(200).send(source);
    },
  });

  // PUT /sources/:id - päivitä uutislähde
  f.route({
    method: 'PUT',
    url: '/sources/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: updateSourceSchema,
      response: {
        200: sourceResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const source = await sourceService.updateSource(request.params.id, request.body);
      if (!source) {
        return reply.code(404).send({ error: 'Uutislähdettä ei löydy' });
      }
      return reply.code(200).send(source);
    },
  });

  // GET /sources/:id/health-logs - lahteen terveyslokit
  f.route({
    method: 'GET',
    url: '/sources/:id/health-logs',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      querystring: z.object({ limit: z.coerce.number().default(20) }),
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            success: z.boolean(),
            itemCount: z.number(),
            errorMessage: z.string().nullable(),
            fetchedAt: z.coerce.date(),
          })
        ),
      },
    },
    handler: async (request, reply) => {
      const logs = await sourceService.getSourceHealthLogs(
        request.params.id,
        request.query.limit
      );
      return reply.code(200).send(logs);
    },
  });

  // PATCH /sources/:id/toggle - vaihda aktiivisuustila
  f.route({
    method: 'PATCH',
    url: '/sources/:id/toggle',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: sourceResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const source = await sourceService.toggleSource(request.params.id);
      if (!source) {
        return reply.code(404).send({ error: 'Uutislähdettä ei löydy' });
      }
      return reply.code(200).send(source);
    },
  });
};

export default sourceRoutes;
