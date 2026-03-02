import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { db } from '../db/index.js';
import { clients, members, deliveryStats, issues } from '../db/schema.js';

const dashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /dashboard/stats -- asiakaskohtaiset tilastot hallintapaneeliin
  f.route({
    method: 'GET',
    url: '/dashboard/stats',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.array(
          z.object({
            clientId: z.number(),
            clientName: z.string(),
            teamSize: z.number(),
            latestSend: z.string().nullable(),
            openRate: z.number(),
          })
        ),
      },
    },
    handler: async (_request, reply) => {
      // Hae kaikki aktiiviset asiakkaat
      const activeClients = await db
        .select()
        .from(clients)
        .where(eq(clients.isActive, true));

      const stats = await Promise.all(
        activeClients.map(async (client) => {
          // Tiimin koko: aktiivisten jasenien maara
          const [teamResult] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(members)
            .where(
              sql`${members.clientId} = ${client.id} AND ${members.isActive} = true`
            );

          // Viimeisin lahetys: MAX sentAt deliveryStats:sta joinattuna issues:n kautta
          const [latestResult] = await db
            .select({
              latestSend: sql<string | null>`max(${deliveryStats.sentAt})::text`,
            })
            .from(deliveryStats)
            .innerJoin(issues, eq(deliveryStats.issueId, issues.id))
            .where(eq(issues.clientId, client.id));

          // Avausprosentti: avattujen osuus ei-failanneista lahetyksista
          const [openResult] = await db
            .select({
              totalDeliveries: sql<number>`count(*)::int`,
              opened: sql<number>`count(case when ${deliveryStats.openedAt} is not null then 1 end)::int`,
            })
            .from(deliveryStats)
            .innerJoin(issues, eq(deliveryStats.issueId, issues.id))
            .where(
              sql`${issues.clientId} = ${client.id} AND ${deliveryStats.status} != 'failed'`
            );

          const totalDeliveries = openResult?.totalDeliveries ?? 0;
          const opened = openResult?.opened ?? 0;
          const openRate =
            totalDeliveries > 0
              ? Math.round((opened / totalDeliveries) * 10000) / 100
              : 0;

          return {
            clientId: client.id,
            clientName: client.name,
            teamSize: teamResult?.count ?? 0,
            latestSend: latestResult?.latestSend ?? null,
            openRate,
          };
        })
      );

      return reply.code(200).send(stats);
    },
  });
};

export default dashboardRoutes;
