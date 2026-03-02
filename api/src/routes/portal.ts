import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { clients, members, issues } from '../db/schema.js';
import { generateMagicLink, verifyMagicLink } from '../services/portalAuth.js';

const portalRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // Portal-spesifinen autentikointikoristelu (role=company)
  const authenticatePortal = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      if (request.user.role !== 'company') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  };

  // ---- Julkiset reitit (ei autentikointia) ----

  // POST /login -- Pyynta magic linkin lahettamiseksi
  f.route({
    method: 'POST',
    url: '/login',
    schema: {
      body: z.object({ email: z.string().email() }),
      response: {
        200: z.object({ message: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { email } = request.body;

      // Laheta magic link taustalla -- alyypi palauttaa aina saman vastauksen
      try {
        await generateMagicLink(fastify, email);
      } catch (err) {
        fastify.log.error({ err }, 'Magic link generation failed');
      }

      return reply.code(200).send({
        message: 'Jos tama sahkoposti on rekisteroity, saat kirjautumislinkin.',
      });
    },
  });

  // POST /verify -- Vahvista magic link -token
  f.route({
    method: 'POST',
    url: '/verify',
    schema: {
      body: z.object({ token: z.string() }),
      response: {
        200: z.object({
          success: z.boolean(),
          redirectUrl: z.string(),
        }),
        401: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { token } = request.body;

      try {
        await verifyMagicLink(fastify, token, reply);
        return reply.code(200).send({
          success: true,
          redirectUrl: '/tiimi',
        });
      } catch {
        return reply.code(401).send({
          error: 'Linkki on vanhentunut tai virheellinen',
        });
      }
    },
  });

  // ---- Suojatut reitit (vaatii role=company) ----

  // GET /members -- Listaa tiimin jasenet kirjautuneelle yritykselle
  f.route({
    method: 'GET',
    url: '/members',
    onRequest: [authenticatePortal],
    schema: {
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
        .where(eq(members.clientId, request.user.clientId!))
        .orderBy(members.createdAt);

      return reply.code(200).send(memberList);
    },
  });

  // POST /members -- Lisaa yksittainen jasen
  f.route({
    method: 'POST',
    url: '/members',
    onRequest: [authenticatePortal],
    schema: {
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
      const clientId = request.user.clientId!;

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

  // POST /members/bulk -- Massalisays
  f.route({
    method: 'POST',
    url: '/members/bulk',
    onRequest: [authenticatePortal],
    schema: {
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
      const clientId = request.user.clientId!;
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

  // PATCH /members/:id -- Pehmeapoisto (passivoi jasen)
  f.route({
    method: 'PATCH',
    url: '/members/:id',
    onRequest: [authenticatePortal],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: z.object({ success: z.boolean() }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const clientId = request.user.clientId!;

      // Tarkista, etta jasen kuuluu kirjautuneelle yritykselle
      const [member] = await db
        .select()
        .from(members)
        .where(and(eq(members.id, id), eq(members.clientId, clientId)));

      if (!member) {
        return reply.code(404).send({ error: 'Jasenta ei loytynyt' });
      }

      await db
        .update(members)
        .set({ isActive: false })
        .where(eq(members.id, id));

      return reply.code(200).send({ success: true });
    },
  });

  // GET /archive -- Lahetetyt uutiskirjeet yritykselle
  f.route({
    method: 'GET',
    url: '/archive',
    onRequest: [authenticatePortal],
    schema: {
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            weekNumber: z.number(),
            year: z.number(),
            status: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
          })
        ),
      },
    },
    handler: async (request, reply) => {
      const sentIssues = await db
        .select({
          id: issues.id,
          weekNumber: issues.weekNumber,
          year: issues.year,
          status: issues.status,
          createdAt: issues.createdAt,
          updatedAt: issues.updatedAt,
        })
        .from(issues)
        .where(
          and(
            eq(issues.clientId, request.user.clientId!),
            eq(issues.status, 'sent')
          )
        )
        .orderBy(desc(issues.updatedAt));

      // Muunna aikaleimat merkkijonoiksi vastausta varten
      const result = sentIssues.map((issue) => ({
        ...issue,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
      }));

      return reply.code(200).send(result);
    },
  });

  // GET /me -- Kirjautuneen portaalikayttajan tiedot
  f.route({
    method: 'GET',
    url: '/me',
    onRequest: [authenticatePortal],
    schema: {
      response: {
        200: z.object({
          companyName: z.string(),
          plan: z.string(),
          contactEmail: z.string(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const [client] = await db
        .select({
          companyName: clients.name,
          plan: clients.plan,
          contactEmail: clients.contactEmail,
        })
        .from(clients)
        .where(eq(clients.id, request.user.clientId!));

      if (!client) {
        return reply.code(404).send({ error: 'Yritys ei loytynyt' });
      }

      return reply.code(200).send(client);
    },
  });

  // POST /logout -- Tyhjenna evasteistunto
  f.route({
    method: 'POST',
    url: '/logout',
    schema: {
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
    handler: async (_request, reply) => {
      return reply
        .clearCookie('token', { path: '/' })
        .code(200)
        .send({ success: true });
    },
  });
};

export default portalRoutes;
