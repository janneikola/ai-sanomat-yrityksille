import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../db/index.js';
import { issues } from '../db/schema.js';
import { generateClientDigest } from '../services/newsletterService.js';

const digestRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /digests/generate -- kaynnista katsauksen generointi asiakkaalle
  f.route({
    method: 'POST',
    url: '/digests/generate',
    onRequest: [fastify.authenticate],
    schema: {
      body: z.object({
        clientId: z.number(),
      }),
      response: {
        201: z.object({
          issueId: z.number(),
          status: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      const { clientId } = request.body;
      const result = await generateClientDigest(clientId);
      return reply.code(201).send(result);
    },
  });

  // GET /digests/:id -- hae yksittainen katsaus parsituilla JSON-kentilla
  f.route({
    method: 'GET',
    url: '/digests/:id',
    onRequest: [fastify.authenticate],
    schema: {
      params: z.object({ id: z.coerce.number() }),
      response: {
        200: z.object({
          id: z.number(),
          clientId: z.number(),
          weekNumber: z.number(),
          year: z.number(),
          status: z.string(),
          generatedContent: z.unknown().nullable(),
          validationReport: z.unknown().nullable(),
          heroImageUrl: z.string().nullable(),
          createdAt: z.date(),
          updatedAt: z.date(),
        }),
        404: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const [issue] = await db
        .select()
        .from(issues)
        .where(eq(issues.id, request.params.id));

      if (!issue) {
        return reply.code(404).send({ error: 'Issue not found' });
      }

      return reply.code(200).send({
        ...issue,
        generatedContent: issue.generatedContent
          ? JSON.parse(issue.generatedContent)
          : null,
        validationReport: issue.validationReport
          ? JSON.parse(issue.validationReport)
          : null,
      });
    },
  });

  // GET /digests -- listaa kaikki katsaukset
  f.route({
    method: 'GET',
    url: '/digests',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.array(
          z.object({
            id: z.number(),
            clientId: z.number(),
            weekNumber: z.number(),
            year: z.number(),
            status: z.string(),
            createdAt: z.date(),
          })
        ),
      },
    },
    handler: async (_request, reply) => {
      const allIssues = await db
        .select({
          id: issues.id,
          clientId: issues.clientId,
          weekNumber: issues.weekNumber,
          year: issues.year,
          status: issues.status,
          createdAt: issues.createdAt,
        })
        .from(issues)
        .orderBy(desc(issues.createdAt));

      return reply.code(200).send(allIssues);
    },
  });
};

export default digestRoutes;
