import 'dotenv/config';
import { db } from './index.js';
import { newsSources, promptTemplates } from './schema.js';

async function seed() {
  console.log('Alustetaan tietokanta...');

  // RSS-uutislähteet
  await db
    .insert(newsSources)
    .values([
      {
        name: 'OpenAI Blog',
        type: 'rss',
        url: 'https://openai.com/blog/rss.xml',
        isActive: true,
      },
      {
        name: 'Anthropic Blog',
        type: 'rss',
        url: 'https://www.anthropic.com/rss.xml',
        isActive: true,
      },
      {
        name: 'Google AI Blog',
        type: 'rss',
        url: 'https://blog.google/technology/ai/rss/',
        isActive: true,
      },
      {
        name: 'TechCrunch AI',
        type: 'rss',
        url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
        isActive: true,
      },
      {
        name: 'The Verge AI',
        type: 'rss',
        url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
        isActive: true,
      },
      {
        name: 'Ars Technica AI',
        type: 'rss',
        url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  // Beehiiv-lähde: AI-Sanomat
  await db
    .insert(newsSources)
    .values({
      name: 'AI-Sanomat (Beehiiv)',
      type: 'beehiiv',
      url: 'https://aisanomat.fi',
      config: JSON.stringify({ publicationId: '' }), // Konfiguroidaan myöhemmin
      isActive: true,
    })
    .onConflictDoNothing();

  // Kehotepohjat
  await db
    .insert(promptTemplates)
    .values([
      {
        name: 'viikkokatsaus_generointi',
        description: 'Viikottaisen tekoälykatsauksen generointi asiakasyritykselle toimialakohtaisesti',
        // NOTE: Update existing production template via admin UI at /templates -- onConflictDoNothing skips if row exists
        template: `Olet tekoälyuutisten asiantuntija, joka kirjoittaa ammattimaisia viikkokatsauksia suomalaisille yrityksille.

Toimiala: {{industry}}
Yrityksen nimi: {{company_name}}
Viikon uutisartikkelit:
{{news_items}}

Aiemmat katsaukset (kontekstia varten):
{{previous_issues}}

Kirjoita lyhyt, asiantunteva viikkokatsaus tekoälyn kehityksestä {{industry}}-alalla. Katsauksen tulee:
- Olla 300-400 sanaa
- Sisältää 3-5 tärkeintä uutista tai kehitystä
- Selittää liiketoimintavaikutukset selkeästi
- Käyttää ammattimaista mutta ymmärrettävää kieltä
- Olla kirjoitettu suomeksi

JOKAISEN UUTISEN RAKENNE:
- title: Uutisen otsikko
- businessImpact: Lyhyt 1-2 lauseen tiivistelmä liiketoimintavaikutuksesta (käytetään varakuvauksena)
- sourceUrl: Lähdeartikkelin URL (käytä alkuperäistä URL:ia uutislistalta)
- lead: Yksi lause joka tiivistää uutisen ydinviestin -- kirjoita napakasti ja informatiivisesti
- contentBlocks: Taulukko rakenteellisista sisältölohkoista:
  - Käytä aina tyyppiä "bullets" ja listaa 2-4 avainpointtia "items"-taulukkoon
  - Jokainen bullet-pointti on lyhyt (max 15 sanaa) ja konkreettinen
  - Bullet-pointit kertovat "mitä tämä tarkoittaa yritykselle" ja "mitä tapahtui"

ESIMERKKI yhdestä storysta:
{
  "title": "OpenAI julkaisi GPT-5:n",
  "businessImpact": "GPT-5 tuo merkittäviä parannuksia yritysten tekoälysovelluksiin.",
  "sourceUrl": "https://openai.com/blog/gpt-5",
  "lead": "OpenAI julkaisi GPT-5-mallin, joka parantaa päättelykykyä 40% edeltäjäänsä nähden.",
  "contentBlocks": [
    {
      "type": "bullets",
      "items": [
        "Päättelykyky parantunut 40% GPT-4o:hon verrattuna",
        "Tukee natiivisti suomen kieltä ilman käännöstä",
        "Yrityshinta laskee 30% tehokkaamman laskennan ansiosta",
        "Saatavilla API:n kautta välittömästi"
      ]
    }
  ]
}`,
        variables: JSON.stringify(['industry', 'company_name', 'news_items', 'previous_issues']),
      },
      {
        name: 'faktojen_validointi',
        description: 'Generoidun viikkokatsauksen faktojen tarkistus lähdeartikkeleja vasten',
        template: `Olet kriittinen toimittaja, joka tarkistaa tekoälykatsauksen faktoja.

Generoitu katsaus:
{{generated_digest}}

Lähdeartikkelit:
{{source_articles}}

Tarkista seuraavat asiat:
1. Onko kaikki väitteet tuettu lähdeartikkeleilla?
2. Onko jokin väite virheellinen tai harhaanjohtava?
3. Puuttuuko jokin tärkeä tieto lähteistä?

Vastaa JSON-muodossa:
{
  "valid": true/false,
  "issues": ["ongelma 1", "ongelma 2"],
  "suggestions": ["parannusehdotus 1"]
}`,
        variables: JSON.stringify(['generated_digest', 'source_articles']),
      },
      {
        name: 'kuvapromptit',
        description: 'Kuvageneraatiopromptien luominen viikkokatsauksen hero-kuvalle',
        template: `Olet kokenut visuaalinen suunnittelija, joka luo tekoälykuvaajille sopivia prompteja.

Katsauksen osiot:
{{digest_sections}}

Toimiala: {{industry}}

Luo kolme vaihtoehtoista DALL-E tai Stable Diffusion -promptia hero-kuvalle, joka:
- Kuvastaa tekoälyä {{industry}}-alalla
- On ammattimainen ja positiivinen
- Välttää kliseitä (ei robotteja, ei sinisiä aivoja)
- Sopii uutiskirjeen visuaaliseen ilmeeseen

Vastaa JSON-muodossa:
{
  "prompts": [
    {"style": "minimalistinen", "prompt": "..."},
    {"style": "realistinen", "prompt": "..."},
    {"style": "abstrakti", "prompt": "..."}
  ]
}`,
        variables: JSON.stringify(['digest_sections', 'industry']),
      },
    ])
    .onConflictDoNothing();

  console.log('Tietokannan alustus valmis.');
}

seed().catch(console.error).finally(() => process.exit(0));
