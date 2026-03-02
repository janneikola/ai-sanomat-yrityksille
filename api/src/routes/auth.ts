import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'jannenne@gmail.com';

const authRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /login - kirjautuminen
  f.route({
    method: 'POST',
    url: '/login',
    schema: {
      body: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
        401: z.object({ error: z.string() }),
      },
    },
    handler: async (request, reply) => {
      const { email, password } = request.body;

      if (email !== ADMIN_EMAIL) {
        return reply.code(401).send({ error: 'Virheelliset tunnukset' });
      }

      const valid = await bcrypt.compare(password, fastify.adminPasswordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'Virheelliset tunnukset' });
      }

      const token = await reply.jwtSign(
        { email, role: 'admin' },
        { expiresIn: '7d' }
      );

      return reply
        .setCookie('token', token, {
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60, // 7 päivää sekunteina
        })
        .code(200)
        .send({ success: true });
    },
  });

  // POST /logout - kirjautuminen ulos
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

  // GET /me - nykyinen käyttäjä
  f.route({
    method: 'GET',
    url: '/me',
    onRequest: [fastify.authenticate],
    schema: {
      response: {
        200: z.object({
          email: z.string(),
          role: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      return reply.code(200).send({
        email: request.user.email,
        role: request.user.role,
      });
    },
  });
};

export default authRoutes;
