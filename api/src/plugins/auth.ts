import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import fcookie from '@fastify/cookie';
import bcrypt from 'bcrypt';
import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    adminPasswordHash: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { email: string; role: string; clientId?: number; purpose?: string };
    user: { email: string; role: string; clientId?: number; purpose?: string };
  }
}

export default fp(async function authPlugin(fastify) {
  // Rekisteröi @fastify/cookie ennen JWT:tä
  await fastify.register(fcookie);

  // Rekisteröi JWT-plugin evästetuen kanssa
  await fastify.register(fjwt, {
    secret: process.env.JWT_SECRET!,
    cookie: { cookieName: 'token', signed: false },
  });

  // Hash admin-salasana käynnistyksen yhteydessä ja tallenna muistiin
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD ympäristömuuttuja puuttuu');
  }
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  fastify.decorate('adminPasswordHash', adminPasswordHash);

  // Autentikointikoristelu suojatuille reiteille
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
