import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import rawBody from 'fastify-raw-body';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import sourceRoutes from './routes/sources.js';
import templateRoutes from './routes/templates.js';
import newsRoutes from './routes/news.js';
import digestRoutes from './routes/digests.js';
import webhookRoutes from './routes/webhooks.js';
import dashboardRoutes from './routes/dashboard.js';
import portalRoutes from './routes/portal.js';
import feedbackRoutes from './routes/feedback.js';
import webSearchRoutes from './routes/webSearch.js';
import deduplicationRoutes from './routes/deduplication.js';
import xMonitoringRoutes from './routes/xMonitoring.js';

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

  // Raw body -tuki webhook-allekirjoitusten vahvistamiseen
  await app.register(rawBody, { global: false });

  // Staattisten tiedostojen tarjoilu (ladatut kuvat sahkoposteja varten)
  await app.register(fastifyStatic, {
    root: path.resolve(process.env.IMAGE_STORAGE_PATH || './uploads'),
    prefix: '/api/images/',
    decorateReply: false,
  });

  // Autentikointiplugin (JWT + eväste + salasanahash)
  await app.register(authPlugin);

  // Terveydentilatarkistus
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Julkiset reitit (ei autentikointia)
  await app.register(webhookRoutes, { prefix: '/api' });
  await app.register(feedbackRoutes, { prefix: '/api' });

  // Autentikoidut reitit
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(clientRoutes, { prefix: '/api/admin' });
  await app.register(sourceRoutes, { prefix: '/api/admin' });
  await app.register(templateRoutes, { prefix: '/api/admin' });
  await app.register(newsRoutes, { prefix: '/api/admin' });
  await app.register(digestRoutes, { prefix: '/api/admin' });
  await app.register(dashboardRoutes, { prefix: '/api/admin' });
  await app.register(webSearchRoutes, { prefix: '/api/admin' });
  await app.register(deduplicationRoutes, { prefix: '/api/admin' });
  await app.register(xMonitoringRoutes, { prefix: '/api/admin' });

  // Portaalireitit (magic link -kirjautuminen ja tiiminhallinta)
  await app.register(portalRoutes, { prefix: '/api/portal' });

  return app;
}
