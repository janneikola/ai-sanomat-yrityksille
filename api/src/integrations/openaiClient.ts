import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/**
 * Generoi yksittaisen tekstin embedding-vektorin OpenAI text-embedding-3-small -mallilla.
 * Palauttaa null jos OPENAI_API_KEY ei ole asetettu tai API-kutsu epaonnistuu.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const openai = getClient();
  if (!openai) {
    console.warn('OPENAI_API_KEY not set, skipping embedding generation');
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('OpenAI embedding generation failed:', error);
    return null;
  }
}

/**
 * Generoi embedding-vektorit usealle tekstille yhdella API-kutsulla (batch).
 * OpenAI tukee jopa 2048 syotetta kerralla.
 * Palauttaa null-taulukon jos OPENAI_API_KEY ei ole asetettu tai API-kutsu epaonnistuu.
 */
export async function generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
  const openai = getClient();
  if (!openai) {
    console.warn('OPENAI_API_KEY not set, skipping batch embedding generation');
    return texts.map(() => null);
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float',
    });

    return response.data.map((d) => d.embedding);
  } catch (error) {
    console.error('OpenAI batch embedding generation failed:', error);
    return texts.map(() => null);
  }
}
