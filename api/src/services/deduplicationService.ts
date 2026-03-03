import { eq, and, isNull, isNotNull, ne, desc, sql, gt } from 'drizzle-orm';
import { cosineDistance } from 'drizzle-orm';
import { db } from '../db/index.js';
import { newsItems } from '../db/schema.js';
import { generateEmbeddings } from '../integrations/openaiClient.js';

// Kynnysarvot: korkean luottamuksen tarkka kopio vs. lahes kopio
const EXACT_DUPLICATE_THRESHOLD = 0.95;
const NEAR_DUPLICATE_THRESHOLD = 0.85;
// Aikaikkuna: vertaa vain viimeisen 14 paivan uutisiin
const DEDUP_WINDOW_DAYS = 14;
// Erakoko: kerralla kasiteltavien uutisten maara
const BATCH_SIZE = 50;

/**
 * Etsii semanttisesti samankaltaiset uutiset annetun embedding-vektorin perusteella.
 * Kayttaa kosinietaisyytta ja HNSW-indeksia pgvectorissa.
 */
export async function findSimilarItems(
  embedding: number[],
  excludeId: number,
  threshold = NEAR_DUPLICATE_THRESHOLD
) {
  const similarity = sql<number>`1 - (${cosineDistance(newsItems.embedding, embedding)})`;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DEDUP_WINDOW_DAYS);

  return db
    .select({
      id: newsItems.id,
      title: newsItems.title,
      url: newsItems.url,
      similarity,
    })
    .from(newsItems)
    .where(
      and(
        gt(similarity, threshold),
        isNotNull(newsItems.embedding),
        ne(newsItems.id, excludeId),
        gt(newsItems.collectedAt, cutoffDate)
      )
    )
    .orderBy(desc(similarity))
    .limit(5);
}

/**
 * Kasittelee uudet uutiset joilla ei ole viela embedding-vektoria:
 * 1. Hakee erallisen uutisten otsikot ja tiivistelmat
 * 2. Generoi embedding-vektorit OpenAI:lla
 * 3. Tallentaa embedding-vektorit tietokantaan
 * 4. Etsii samankaltaiset uutiset ja merkitsee duplikaatit
 */
export async function processNewEmbeddings(): Promise<{
  embedded: number;
  duplicatesFound: number;
}> {
  // Hae uutiset joilla ei ole viela embedding-vektoria
  const unembedded = await db
    .select()
    .from(newsItems)
    .where(isNull(newsItems.embedding))
    .orderBy(newsItems.id)
    .limit(BATCH_SIZE);

  if (unembedded.length === 0) {
    return { embedded: 0, duplicatesFound: 0 };
  }

  // Rakenna tekstitaulukko: otsikko + tiivistelma
  const texts = unembedded.map(
    (item) => `${item.title}${item.summary ? ' ' + item.summary : ''}`
  );

  // Generoi embedding-vektorit
  const embeddings = await generateEmbeddings(texts);

  // Tarkista onko API-avain asetettu (kaikki null = ei avainta)
  const allNull = embeddings.every((e) => e === null);
  if (allNull) {
    return { embedded: 0, duplicatesFound: 0 };
  }

  let embeddedCount = 0;
  let duplicatesFound = 0;

  for (let i = 0; i < unembedded.length; i++) {
    const item = unembedded[i];
    const embedding = embeddings[i];
    if (!embedding) continue;

    // Tallenna embedding tietokantaan
    await db
      .update(newsItems)
      .set({ embedding })
      .where(eq(newsItems.id, item.id));

    embeddedCount++;

    // Etsi samankaltaiset uutiset
    const similar = await findSimilarItems(embedding, item.id);

    if (similar.length > 0) {
      // Kanoninen = vanhin (pienin ID) samankaltainen uutinen
      const canonical = similar.reduce((min, s) => (s.id < min.id ? s : min));

      if (canonical.id < item.id) {
        // Nykyinen uutinen on uudempi -> merkitaan se duplikaatiksi
        await db
          .update(newsItems)
          .set({ isDuplicate: true, canonicalItemId: canonical.id })
          .where(eq(newsItems.id, item.id));
      } else {
        // Nykyinen uutinen on vanhempi -> merkitaan samankaltainen duplikaatiksi
        await db
          .update(newsItems)
          .set({ isDuplicate: true, canonicalItemId: item.id })
          .where(eq(newsItems.id, canonical.id));
      }

      duplicatesFound++;
    }
  }

  return { embedded: embeddedCount, duplicatesFound };
}

/**
 * Poistaa duplikaattimerkinnon uutiselta (vaarin tunnistettu duplikaatti).
 */
export async function overrideDuplicate(itemId: number): Promise<boolean> {
  const result = await db
    .update(newsItems)
    .set({ isDuplicate: false, canonicalItemId: null })
    .where(eq(newsItems.id, itemId));

  return (result.rowCount ?? 0) > 0;
}

/**
 * Hakee merkityt duplikaatit ja niiden kanooniset uutiset.
 * Laskee samankaltaisuuspisteet uudelleen embedding-vektoreista.
 */
export async function getDuplicates(limit = 100) {
  // Hae duplikaatit
  const duplicates = await db
    .select()
    .from(newsItems)
    .where(eq(newsItems.isDuplicate, true))
    .orderBy(desc(newsItems.collectedAt))
    .limit(limit);

  if (duplicates.length === 0) {
    return [];
  }

  // Hae kanonisten uutisten ID:t
  const canonicalIds = [
    ...new Set(
      duplicates
        .map((d) => d.canonicalItemId)
        .filter((id): id is number => id !== null)
    ),
  ];

  // Hae kanooniset uutiset
  const canonicals =
    canonicalIds.length > 0
      ? await db
          .select()
          .from(newsItems)
          .where(
            sql`${newsItems.id} IN (${sql.join(
              canonicalIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
      : [];

  const canonicalMap = new Map(canonicals.map((c) => [c.id, c]));

  // Rakenna vastaus samankaltaisuuspisteilla
  return duplicates.map((dup) => {
    const canonical = dup.canonicalItemId
      ? canonicalMap.get(dup.canonicalItemId)
      : null;

    // Laske samankaltaisuus embedding-vektoreista (jos molemmat olemassa)
    let similarity: number | null = null;
    if (dup.embedding && canonical?.embedding) {
      // Kosini-samankaltaisuus: 1 - kosinieta isyys
      const a = dup.embedding as number[];
      const b = canonical.embedding as number[];
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    return {
      id: dup.id,
      title: dup.title,
      url: dup.url,
      collectedAt: dup.collectedAt,
      canonicalItemId: dup.canonicalItemId,
      canonicalTitle: canonical?.title ?? null,
      canonicalUrl: canonical?.url ?? null,
      similarity,
    };
  });
}
