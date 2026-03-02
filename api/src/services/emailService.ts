import { render } from '@react-email/render';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { issues, clients, members, deliveryStats } from '../db/schema.js';
import { DigestEmail } from '../emails/DigestEmail.js';
import type { DigestEmailDigest } from '../emails/DigestEmail.js';
import { sendBatchEmails } from '../integrations/resendClient.js';

/**
 * Renderoi React Email -pohjan HTML- ja tekstiversioiksi.
 */
export async function renderDigestEmail(
  issue: {
    generatedContent: string | null;
    heroImageUrl: string | null;
  },
  client: { name: string }
): Promise<{ html: string; text: string }> {
  if (!issue.generatedContent) {
    throw new Error('Issue has no generated content');
  }

  const digest = JSON.parse(issue.generatedContent) as DigestEmailDigest;
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

  // Muodosta absoluuttiset kuva-URL:t
  const heroImageUrl = issue.heroImageUrl
    ? `${baseUrl}${issue.heroImageUrl.startsWith('/') ? '' : '/'}${issue.heroImageUrl}`
    : null;

  const storiesWithAbsoluteUrls = digest.stories.map((story) => ({
    ...story,
    imageUrl: story.imageUrl
      ? `${baseUrl}${story.imageUrl.startsWith('/') ? '' : '/'}${story.imageUrl}`
      : undefined,
  }));

  const emailProps = {
    clientName: client.name,
    digest: { ...digest, stories: storiesWithAbsoluteUrls },
    heroImageUrl,
    unsubscribeUrl: '', // Placeholder -- korvataan per-jasen lahettaessa
  };

  const html = await render(DigestEmail(emailProps));
  const text = await render(DigestEmail(emailProps), { plainText: true });

  return { html, text };
}

/**
 * Orkestroi katsauksen lahettamisen kaikille asiakkaan aktiivisille jasenille.
 * Luo deliveryStats-tietueet ja paivittaa issuen tilaksi 'sent'.
 */
export async function sendDigestToClient(
  issueId: number
): Promise<{ sent: number; issueId: number }> {
  // 1. Hae issue (pitaa olla 'approved' tilassa)
  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId));

  if (!issue) {
    throw new Error(`Issue not found: ${issueId}`);
  }
  if (issue.status !== 'approved') {
    throw new Error(`Issue ${issueId} is not approved (status: ${issue.status})`);
  }

  // 2. Hae asiakas
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, issue.clientId));

  if (!client) {
    throw new Error(`Client not found: ${issue.clientId}`);
  }

  // 3. Hae aktiiviset, ei-bouncanneet jasenet
  const activeMembers = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.clientId, issue.clientId),
        eq(members.isActive, true),
        eq(members.isBounced, false)
      )
    );

  if (activeMembers.length === 0) {
    throw new Error(`No active members for client ${issue.clientId}`);
  }

  // 4. Renderoi sahkoposti
  const { html, text } = await renderDigestEmail(issue, client);

  // 5. Rakenna sahkopostipaketit jokaiselle jasenelle
  const emailPayloads = activeMembers.map((member) => ({
    from: 'AI-Sanomat <noreply@mail.aisanomat.fi>',
    to: member.email,
    subject: `AI-Sanomat viikkokatsaus: ${client.name}`,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<https://app.aisanomat.fi/api/unsubscribe?member=${member.id}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }));

  // 6. Laheta erana
  const results = await sendBatchEmails(emailPayloads);

  // 7. Luo deliveryStats-tietueet
  const now = new Date();
  await db.insert(deliveryStats).values(
    activeMembers.map((member, i) => ({
      issueId: issue.id,
      memberId: member.id,
      status: 'sent' as const,
      resendMessageId: results[i]?.id ?? null,
      sentAt: now,
    }))
  );

  // 8. Paivita issue tilaksi 'sent'
  await db
    .update(issues)
    .set({ status: 'sent' })
    .where(eq(issues.id, issue.id));

  return { sent: activeMembers.length, issueId: issue.id };
}
