import { eq } from 'drizzle-orm';
import { Webhook } from 'svix';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { deliveryStats, members } from '../db/schema.js';

// Resend-tapahtuman tyyppi
interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    bounce?: {
      message: string;
      type: string;
      subType?: string;
    };
  };
}

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /webhooks/resend -- julkinen webhook Resend-tapahtumille
  fastify.route({
    method: 'POST',
    url: '/webhooks/resend',
    config: { rawBody: true },
    handler: async (request, reply) => {
      // 1. Vahvista Svix-allekirjoitus
      const secret = process.env.RESEND_WEBHOOK_SECRET;
      if (!secret) {
        fastify.log.error('RESEND_WEBHOOK_SECRET not configured');
        return reply.code(500).send({ error: 'Webhook secret not configured' });
      }

      const svixId = request.headers['svix-id'] as string | undefined;
      const svixTimestamp = request.headers['svix-timestamp'] as string | undefined;
      const svixSignature = request.headers['svix-signature'] as string | undefined;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.code(400).send({ error: 'Missing svix headers' });
      }

      let event: ResendWebhookEvent;
      try {
        const wh = new Webhook(secret);
        const rawBody = (request as unknown as { rawBody: string }).rawBody;
        event = wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as ResendWebhookEvent;
      } catch (err) {
        fastify.log.warn({ err }, 'Webhook signature verification failed');
        return reply.code(400).send({ error: 'Invalid signature' });
      }

      // 2. Kasittele tapahtumatyyppi
      const emailId = event.data.email_id;

      try {
        switch (event.type) {
          case 'email.delivered': {
            await db
              .update(deliveryStats)
              .set({ status: 'delivered' })
              .where(eq(deliveryStats.resendMessageId, emailId));
            break;
          }

          case 'email.opened': {
            await db
              .update(deliveryStats)
              .set({ status: 'opened', openedAt: new Date() })
              .where(eq(deliveryStats.resendMessageId, emailId));
            break;
          }

          case 'email.bounced': {
            // Paivita deliveryStats
            const [bouncedStat] = await db
              .update(deliveryStats)
              .set({ status: 'bounced', bouncedAt: new Date() })
              .where(eq(deliveryStats.resendMessageId, emailId))
              .returning();

            // Jos pysyva bounce, merkitse jasen bouncenneeksi
            if (
              bouncedStat &&
              event.data.bounce?.type === 'Permanent'
            ) {
              await db
                .update(members)
                .set({ isBounced: true })
                .where(eq(members.id, bouncedStat.memberId));
            }
            break;
          }

          default:
            fastify.log.info(`Unhandled Resend event type: ${event.type}`);
        }
      } catch (err) {
        // Lokita virhe mutta palautetaan silti 200 ettei Resend uudelleenyrita
        fastify.log.error({ err }, `Error processing webhook event ${event.type}`);
      }

      return reply.code(200).send({ received: true });
    },
  });
};

export default webhookRoutes;
