import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createClientSchema,
  updateClientSchema,
  clientResponseSchema,
} from '@ai-sanomat/shared';
import * as clientService from '../services/clients.js';

const clientRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /clients - listaa kaikki asiakkaat
  f.route({
    method: 'GET',
    url: '/clients',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.array(clientResponseSchema),
      },
    },
    handler: async (_request, reply) => {
      const result = await clientService.listClients();
      return reply.code(200).send(result);
    },
  });

  // POST /clients - luo uusi asiakas
  f.route({
    method: 'POST',
    url: '/clients',
    onRequest: [fastify.authenticate],
    schema: {
      body: createClientSchema,
      response: {
        201: clientResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const client = await clientService.createClient(request.body);
      return reply.code(201).send(client);
    },
  });

  // GET /clients/:id - hae yksittäinen asiakas
  f.route({
    method: 'GET',
    url: '/clients/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: clientResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const client = await clientService.getClient(request.params.id);
      if (!client) {
        return reply.code(404).send({ error: 'Asiakasta ei löydy' });
      }
      return reply.code(200).send(client);
    },
  });

  // PUT /clients/:id - päivitä asiakas
  f.route({
    method: 'PUT',
    url: '/clients/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: updateClientSchema,
      response: {
        200: clientResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const client = await clientService.updateClient(request.params.id, request.body);
      if (!client) {
        return reply.code(404).send({ error: 'Asiakasta ei löydy' });
      }
      return reply.code(200).send(client);
    },
  });
};

export default clientRoutes;
