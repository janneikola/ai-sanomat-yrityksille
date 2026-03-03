import { render } from '@react-email/render';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { issues, clients, members, deliveryStats } from '../db/schema.js';
import { DigestEmail } from '../emails/DigestEmail.js';
import type { DigestEmailDigest } from '../emails/DigestEmail.js';
import { sendBatchEmails, sendSingleEmail } from '../integrations/resendClient.js';
import { getFeaturedPosts } from './featuredPostsService.js';

/**
 * Renderoi React Email -pohjan HTML- ja tekstiversioiksi.
 */
export async function renderDigestEmail(
  issue: {
    generatedContent: string | null;
    heroImageUrl: string | null;
  },
  client: { name: string; industry: string },
  feedbackUrls?: { up: string; down: string }
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

  // Query featured posts for "AI-Sanomat suosittelee" section
  const featuredPosts = await getFeaturedPosts(3);

  const emailProps = {
    clientName: client.name,
    clientIndustry: client.industry,
    digest: { ...digest, stories: storiesWithAbsoluteUrls },
    heroImageUrl,
    featuredPosts,
    feedbackUrls,
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
  const { html, text } = await renderDigestEmail(issue, {
    name: client.name,
    industry: client.industry,
  });

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

/**
 * Lahettaa admin-ilmoitussahkopostin.
 * Vastaanottaja: ADMIN_EMAIL ymparistomuuttuja tai oletusarvo.
 * Lahettaja: sama kuin uutiskirjeissa.
 */
export async function sendAdminNotification(
  subject: string,
  htmlBody: string
): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@aisanomat.fi';
  const from = 'AI-Sanomat <noreply@mail.aisanomat.fi>';

  // Yksinkertainen HTML-pohja
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${htmlBody}
  <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
  <p style="color: #999; font-size: 12px;">AI-Sanomat automaattinen ilmoitus</p>
</body>
</html>`;

  // Pelkka teksti -- riisutaan HTML-tagit
  const text = htmlBody.replace(/<[^>]*>/g, '').trim();

  try {
    await sendSingleEmail({ from, to: adminEmail, subject, html, text });
  } catch (error) {
    console.error('Failed to send admin notification:', error);
    // Don't throw -- admin notification failure should not block the calling process
  }
}
