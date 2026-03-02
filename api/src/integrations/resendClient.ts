import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

/**
 * Lahettaa sahkopostit erana Resend batch.send() -rajapinnan kautta.
 * Jakaa automaattisesti yli 100 sahkopostin listat useampaan erakutsuun.
 */
export async function sendBatchEmails(
  emails: EmailPayload[]
): Promise<Array<{ id: string }>> {
  const BATCH_SIZE = 100;
  const results: Array<{ id: string }> = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE);

    const response = await getResend().batch.send(
      chunk.map((email) => ({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      }))
    );

    if (response.error) {
      throw new Error(
        `Resend batch send failed: ${response.error.message}`
      );
    }

    if (response.data) {
      results.push(
        ...response.data.data.map((item) => ({ id: item.id }))
      );
    }
  }

  return results;
}

/**
 * Lahettaa yksittaisen sahkopostin Resend-rajapinnan kautta.
 * Kaytossa magic link -viestien lahettamiseen.
 */
export async function sendSingleEmail(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ id: string }> {
  const response = await getResend().emails.send(payload);
  if (response.error) {
    throw new Error(`Resend send failed: ${response.error.message}`);
  }
  return { id: response.data!.id };
}
