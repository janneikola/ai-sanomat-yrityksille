import { render } from '@react-email/render';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { clients } from '../db/schema.js';
import { MagicLinkEmail } from '../emails/MagicLinkEmail.js';
import { sendSingleEmail } from '../integrations/resendClient.js';

/**
 * Generoi magic link -tokenin ja lahettaa sen sahkopostilla.
 * Palauttaa hiljaisesti, vaikka sahkopostia ei loydyisi (estaa enumeraation).
 */
export async function generateMagicLink(
  app: FastifyInstance,
  contactEmail: string
): Promise<void> {
  // Etsi asiakas contact_email:n perusteella (case-insensitive)
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.contactEmail, contactEmail.toLowerCase()));

  if (!client) {
    // Ei kerrota kayttajalle, ettei sahkopostia loydy
    app.log.info({ email: contactEmail }, 'Magic link requested for unknown email');
    return;
  }

  // Allekirjoita lyhytaikainen magic link -token (15 min)
  const magicToken = app.jwt.sign(
    { email: contactEmail, clientId: client.id, purpose: 'magic-link', role: 'company' },
    { expiresIn: '15m' }
  );

  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
  const magicLinkUrl = `${publicUrl}/portal/verify?token=${magicToken}`;

  // Renderoi sahkopostipohja
  const html = await render(MagicLinkEmail({ magicLinkUrl, companyName: client.name }));
  const text = await render(MagicLinkEmail({ magicLinkUrl, companyName: client.name }), {
    plainText: true,
  });

  // Laheta magic link sahkoposti
  await sendSingleEmail({
    from: 'AI-Sanomat <katsaus@mail.aisanomat.fi>',
    to: contactEmail,
    subject: 'Kirjaudu AI-Sanomat-portaaliin',
    html,
    text,
  });

  app.log.info({ email: contactEmail, clientId: client.id }, 'Magic link sent');
}

/**
 * Vahvistaa magic link -tokenin ja asettaa sessio-JWT:n evasteeksi.
 */
export async function verifyMagicLink(
  app: FastifyInstance,
  token: string,
  reply: FastifyReply
): Promise<{ success: true; clientId: number }> {
  // Vahvista token -- heittaa virheen, jos vanhentunut/viallinen
  const decoded = app.jwt.verify<{
    email: string;
    clientId: number;
    purpose: string;
    role: string;
  }>(token);

  // Tarkista, etta token on magic link -tyyppinen
  if (decoded.purpose !== 'magic-link') {
    throw new Error('Invalid token purpose');
  }

  // Tarkista, etta asiakas on viela aktiivinen
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, decoded.clientId));

  if (!client || !client.isActive) {
    throw new Error('Client not found or inactive');
  }

  // Allekirjoita sessio-JWT (7 paivaa)
  const sessionToken = await reply.jwtSign(
    { email: decoded.email, role: 'company', clientId: decoded.clientId },
    { expiresIn: '7d' }
  );

  // Aseta evasteeksi samalla tavalla kuin admin-kirjautumisessa
  reply.setCookie('token', sessionToken, {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 paivaa sekunteina
  });

  return { success: true, clientId: decoded.clientId };
}
