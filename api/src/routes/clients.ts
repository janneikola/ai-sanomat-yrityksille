import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  createClientSchema,
  updateClientSchema,
  clientResponseSchema,
} from '@ai-sanomat/shared';
import * as clientService from '../services/clients.js';
import { db } from '../db/index.js';
import { members } from '../db/schema.js';

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
  // PUT /clients/:id/schedule - paivita asiakkaan ajoitusasetukset
  f.route({
    method: 'PUT',
    url: '/clients/:id/schedule',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({
        scheduleFrequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
        scheduleDay: z.number().int().min(0).max(6).optional(),
        scheduleBiweeklyWeek: z.enum(['even', 'odd']).nullable().optional(),
        schedulePaused: z.boolean().optional(),
      }),
      response: {
        200: clientResponseSchema,
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const client = await clientService.updateClientSchedule(request.params.id, request.body);
      if (!client) {
        return reply.code(404).send({ error: 'Asiakasta ei löydy' });
      }
      return reply.code(200).send(client);
    },
  });

  // ---- Member (vastaanottaja) management endpoints ----

  // GET /clients/:id/members - listaa asiakkaan kaikki vastaanottajat (ml. poistetut)
  f.route({
    method: 'GET',
    url: '/clients/:id/members',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            email: z.string(),
            name: z.string().nullable(),
            isActive: z.boolean(),
            isBounced: z.boolean(),
          })
        ),
      },
    },
    handler: async (request, reply) => {
      const memberList = await db
        .select({
          id: members.id,
          email: members.email,
          name: members.name,
          isActive: members.isActive,
          isBounced: members.isBounced,
        })
        .from(members)
        .where(eq(members.clientId, request.params.id))
        .orderBy(members.createdAt);

      return reply.code(200).send(memberList);
    },
  });

  // POST /clients/:id/members - lisaa yksittainen vastaanottaja
  f.route({
    method: 'POST',
    url: '/clients/:id/members',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }),
      response: {
        200: z.object({
          id: z.number(),
          email: z.string(),
          name: z.string().nullable(),
          isActive: z.boolean(),
          isBounced: z.boolean(),
        }),
        409: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { email, name } = request.body;
      const clientId = request.params.id;

      // Tarkista, onko jasen jo olemassa
      const [existing] = await db
        .select()
        .from(members)
        .where(and(eq(members.clientId, clientId), eq(members.email, email)));

      if (existing) {
        if (existing.isActive) {
          return reply.code(409).send({ error: 'Jasen on jo lisatty' });
        }

        // Uudelleenaktivoi passivoitu jasen
        const [reactivated] = await db
          .update(members)
          .set({ isActive: true, isBounced: false, name: name ?? existing.name })
          .where(eq(members.id, existing.id))
          .returning({
            id: members.id,
            email: members.email,
            name: members.name,
            isActive: members.isActive,
            isBounced: members.isBounced,
          });

        return reply.code(200).send(reactivated);
      }

      // Lisaa uusi jasen
      const [created] = await db
        .insert(members)
        .values({ clientId, email, name: name ?? null })
        .returning({
          id: members.id,
          email: members.email,
          name: members.name,
          isActive: members.isActive,
          isBounced: members.isBounced,
        });

      return reply.code(200).send(created);
    },
  });

  // POST /clients/:id/members/bulk - massalisays
  f.route({
    method: 'POST',
    url: '/clients/:id/members/bulk',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      body: z.object({ emails: z.string() }),
      response: {
        200: z.object({
          added: z.number(),
          reactivated: z.number(),
          skipped: z.number(),
          invalid: z.array(z.string()),
        }),
      },
    },
    handler: async (request, reply) => {
      const { emails } = request.body;
      const clientId = request.params.id;
      const emailValidator = z.string().email();

      // Parsitaan pilkuin eroteltu lista
      const rawEmails = emails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      let added = 0;
      let reactivated = 0;
      let skipped = 0;
      const invalid: string[] = [];

      for (const rawEmail of rawEmails) {
        const result = emailValidator.safeParse(rawEmail);
        if (!result.success) {
          invalid.push(rawEmail);
          continue;
        }

        const email = result.data;

        const [existing] = await db
          .select()
          .from(members)
          .where(and(eq(members.clientId, clientId), eq(members.email, email)));

        if (existing) {
          if (existing.isActive) {
            skipped++;
            continue;
          }
          // Uudelleenaktivoi
          await db
            .update(members)
            .set({ isActive: true, isBounced: false })
            .where(eq(members.id, existing.id));
          reactivated++;
        } else {
          await db.insert(members).values({ clientId, email });
          added++;
        }
      }

      return reply.code(200).send({ added, reactivated, skipped, invalid });
    },
  });

  // PATCH /clients/:id/members/:memberId - pehmeapoisto (passivoi vastaanottaja)
  f.route({
    method: 'PATCH',
    url: '/clients/:id/members/:memberId',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({
        id: z.coerce.number(),
        memberId: z.coerce.number(),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { id: clientId, memberId } = request.params;

      // Tarkista, etta jasen kuuluu taelle asiakkaalle
      const [member] = await db
        .select()
        .from(members)
        .where(and(eq(members.id, memberId), eq(members.clientId, clientId)));

      if (!member) {
        return reply.code(404).send({ error: 'Jasenta ei loytynyt' });
      }

      await db
        .update(members)
        .set({ isActive: false })
        .where(eq(members.id, memberId));

      return reply.code(200).send({ success: true });
    },
  });
};

export default clientRoutes;
