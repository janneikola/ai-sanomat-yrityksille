import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { recordVote } from '../services/feedbackService.js';

const feedbackRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /feedback/vote?token=... -- PUBLIC, ei autentikointia
  // Lukija klikkaa sahkopostissa olevaa peukkulinkkia ja paatyy tanne
  f.route({
    method: 'GET',
    url: '/feedback/vote',
    schema: {
      querystring: z.object({ token: z.string() }),
    },
    handler: async (request, reply) => {
      const { token } = request.query as { token: string };

      try {
        const decoded = fastify.jwt.verify<{
          memberId: number;
          issueId: number;
          vote: string;
          purpose: string;
        }>(token);

        // Varmista etta kyseessa on palautetoken, ei kaapattu admin/portaalitoken
        if (decoded.purpose !== 'feedback') {
          return reply.code(400).send({ error: 'Virheellinen linkki' });
        }

        if (decoded.vote !== 'up' && decoded.vote !== 'down') {
          return reply.code(400).send({ error: 'Virheellinen aanestys' });
        }

        await recordVote(decoded.memberId, decoded.issueId, decoded.vote as 'up' | 'down');

        // Uudelleenohjaa aisanomat.fi-etusivulle (liikennetta + vahvistaa aanestyksen)
        return reply.redirect('https://aisanomat.fi');
      } catch {
        // Vanhentunut tai manipuloitu token -- ystävällinen virheilmoitus
        return reply.code(400).send({
          error: 'Linkki on vanhentunut tai virheellinen. Kiitos mielenkiinnostasi!',
        });
      }
    },
  });
};

export default feedbackRoutes;
