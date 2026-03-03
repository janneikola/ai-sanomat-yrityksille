import { eq, desc, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, issues, newsItems, promptTemplates } from '../db/schema.js';
import { generateDigest, validateDigest, generateImagePrompts } from '../integrations/claudeClient.js';
import { generateDigestImages } from './imageService.js';
import { getISOWeekNumber, getPeriodNumber } from './scheduleService.js';
import type { DigestContent } from '../types/digest.js';

/**
 * Taytta kehotepohjaan muuttujat korvaamalla {{muuttuja}} -patternit arvoilla.
 */
export function fillTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

/**
 * Laskee ISO-viikkonumeron nykyiselle paivamaaralle.
 * Wrapper getISOWeekNumber-funktiolle taaksepainyhteensopivuuden vuoksi.
 */
function getWeekNumber(): number {
  return getISOWeekNumber(new Date());
}

// Humanizer-taidon 26 AI-patternia validointia varten
const AI_PATTERN_RULES = `
Tarkista teksti seuraavien 26 AI-kirjoituspatternia osalta ja raportoi loydetyt:

SUOMENKIELISET PATTERNIT (1-12):
1. Passiivin ylikaytto - AI kayttaa passiivia kaikkialla valttaakseen tekijan nimeamista
2. Nominaalirakenteet - Verbi muutetaan substantiiviksi + tukiverbi ("suorittaa tarkistuksen" vs "tarkistaa")
3. Pronominien ylikaytto - Tarpeettomat "me", "se", "tama" englannin mallin mukaan
4. Puuttuvat partikkelit - -han/-han, -pa/-pa, kylla, vaan puuttuvat, vaikka ovat normaalia suomea
5. Kaannosrakenteet - Englannin sanajärjestystä ja rakenteita suomeksi
6. Genetiiviketjut - Perakkaiset genetiivimuodot kasautuvat
7. Adjektiivikasaumat - Useita adjektiiveja perakkkain
8. Ylipitkat virkkeet - Monta ajatusta pakattu yhteen virkkeeseen
9. Joka/jotka-kasautuminen - Sivulauseiden ketjuttaminen
10. Virkakielisyys vaarassa kontekstissa - "Kyseinen", "edella mainittu" epamuodollisessa tekstissa
11. Astevaihtelun valttely - Turvallisten sanojen valinta monimutkaisempien sijaan
12. Liiallinen kohteliaisuus - Englannin kohteliaisuusnormit suomessa

UNIVERSAALIT PATTERNIT SUOMEKSI (13-26):
13. Merkittavyyden liioittelu - Kaikki on "merkittavaa", "keskeista", "ratkaisevaa"
14. Mainosmainen kieli - "Ainutlaatuinen", "uraauurtava", "vertaansa vailla"
15. Mielisteleva savy - "Hyva kysymys!", "Ehdottomasti!"
16. Liiallinen varautuminen - "Saattaisi mahdollisesti", "voitaneen todeta"
17. Taytesanat ja -lauseet - "On syyta huomata", "Tassa yhteydessa"
18. Geneerinen lopetus - "Tulevaisuus nayttaa valoisalta"
19. Epamaaraiset viittaukset - "Asiantuntijoiden mukaan", "tutkimukset osoittavat"
20. "Haasteista huolimatta" -kaava - Tunnustaa haasteen mutta mitatoi sen heti
21. Kolmen saanto ja synonyymikierto - Listaa kolmen ryhmissa, kierrattaa synonyymeja
22. Partisiippirakenteet - -malla/-malla ylikaytto
23. Kopulan valttely - Yksinkertaisen "on" korvaus monimutkaisemmilla verbeilla
24. Negatiivinen rinnastus - "Ei pelkastaan...vaan myos" ylikaytto
25. Keinotekoiset skaalaviittaukset - "X:sta Y:hyn" valeellinen kattavuus
26. Tietokatkos-vastuuvapauslausekkeet - "Viimeisimpien tietojeni mukaan"

Raportoi jokaisesta loydetysta patternista: patternId, patternName, example (tekstikatkelma), suggestion (korjausehdotus).
Anna languageQuality.score valilla 1-10 (10 = taysin luonnollinen suomi).
`;

/**
 * Generoi asiakkaan viikkokatsauksen. Orkestroi koko putkilinjan:
 * 1. Hae asiakas ja uutiset
 * 2. Generoi katsaus (Claude)
 * 3. Validoi katsaus (Claude)
 * 4. Generoi kuvapromptit (Claude)
 * 5. Generoi kuvat (Gemini)
 * 6. Paivita issue-tietue
 */
export async function generateClientDigest(
  clientId: number,
  sinceDate?: Date
): Promise<{ issueId: number; status: string }> {
  // 1. Hae asiakas
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId));
  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  // 2. Hae viimeisimmat uutiset (max 30 kpl, valinnaisesti ikkunoituna)
  const newsQuery = db
    .select()
    .from(newsItems);

  let recentNews;
  if (sinceDate) {
    recentNews = await newsQuery
      .where(gt(newsItems.collectedAt, sinceDate))
      .orderBy(desc(newsItems.collectedAt))
      .limit(30);
  } else {
    recentNews = await newsQuery
      .orderBy(desc(newsItems.collectedAt))
      .limit(30);
  }

  const formattedNews = recentNews
    .map((item) => `- ${item.title}${item.summary ? ': ' + item.summary : ''} (${item.url})`)
    .join('\n');

  // 3. Hae kehotepohjat
  const [generationTemplate] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.name, 'viikkokatsaus_generointi'));
  const [validationTemplate] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.name, 'faktojen_validointi'));
  const [imageTemplate] = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.name, 'kuvapromptit'));

  if (!generationTemplate || !validationTemplate || !imageTemplate) {
    throw new Error('Required prompt templates not found in database');
  }

  // 4. Luo issue-tietue tilassa 'generating'
  const now = new Date();
  const clientRow = await db.select().from(clients).where(eq(clients.id, clientId));
  const scheduleFreq = clientRow[0]?.scheduleFrequency ?? 'weekly';
  const [issue] = await db
    .insert(issues)
    .values({
      clientId,
      weekNumber: getWeekNumber(),
      year: now.getFullYear(),
      periodNumber: getPeriodNumber(scheduleFreq, now),
      status: 'generating',
    })
    .returning();

  try {
    // 5. Generoi katsaus
    const generationSystemPrompt = fillTemplate(generationTemplate.template, {
      industry: client.industry,
      company_name: client.name,
      news_items: formattedNews,
      previous_issues: '',
    });

    const digest = await generateDigest(
      generationSystemPrompt,
      'Generoi viikkokatsaus'
    );

    // 6. Paivita issue: sisalto + tila -> validating
    await db
      .update(issues)
      .set({
        generatedContent: JSON.stringify(digest),
        status: 'validating',
      })
      .where(eq(issues.id, issue.id));

    // 7. Validoi katsaus (faktat + suomen kielen laatu)
    const validationSystemPrompt = fillTemplate(validationTemplate.template, {
      generated_digest: JSON.stringify(digest),
      source_articles: formattedNews,
    }) + '\n\n' + AI_PATTERN_RULES;

    const validationReport = await validateDigest(
      validationSystemPrompt,
      'Validoi katsaus'
    );

    // 8. Tallenna validointiraportti
    await db
      .update(issues)
      .set({
        validationReport: JSON.stringify(validationReport),
      })
      .where(eq(issues.id, issue.id));

    // 9. Generoi kuvapromptit
    const imageSystemPrompt = fillTemplate(imageTemplate.template, {
      digest_sections: JSON.stringify(digest.stories),
      industry: client.industry,
    });

    const imagePrompts = await generateImagePrompts(
      imageSystemPrompt,
      'Generoi kuvapromptit'
    );

    // 10. Generoi kuvat
    const images = await generateDigestImages(imagePrompts);

    // 11. Paivita katsaus kuva-URL:illa ja aseta tilaksi 'ready'
    const updatedDigest: DigestContent & { stories: Array<DigestContent['stories'][number] & { imageUrl?: string }> } = {
      ...digest,
      stories: digest.stories.map((story, i) => ({
        ...story,
        imageUrl: images.sectionUrls[i],
      })),
    };

    await db
      .update(issues)
      .set({
        heroImageUrl: images.heroUrl,
        generatedContent: JSON.stringify(updatedDigest),
        status: 'ready',
      })
      .where(eq(issues.id, issue.id));

    return { issueId: issue.id, status: 'ready' };
  } catch (error) {
    // Mika tahansa virhe putkilinjassa -> aseta issue tilaan 'failed'
    console.error(`Digest generation failed for client ${clientId}:`, error);
    await db
      .update(issues)
      .set({ status: 'failed' })
      .where(eq(issues.id, issue.id));
    throw error;
  }
}
