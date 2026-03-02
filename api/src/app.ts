import Fastify from 'fastify';
import cors from '@fastify/cors';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import sourceRoutes from './routes/sources.js';
import templateRoutes from './routes/templates.js';

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Zod-validoija ja serialisoija
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // CORS-asetukset API-frontend-kommunikaatiota varten
  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  // Autentikointiplugin (JWT + eväste + salasanahash)
  await app.register(authPlugin);

  // Terveydentilatarkistus
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Reitit
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(clientRoutes, { prefix: '/api/admin' });
  await app.register(sourceRoutes, { prefix: '/api/admin' });
  await app.register(templateRoutes, { prefix: '/api/admin' });

  return app;
}
