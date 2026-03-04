import type { ImagePrompts } from '../types/digest.js';
import { generateImage } from '../integrations/geminiClient.js';

/**
 * Generoi kaikki katsauksen kuvat: hero-kuva + osioiden kuvat.
 * Kukin generoidaan perakkkain (ei Promise.all) Geminin nopeusrajoitusten valttamiseksi.
 * Jos yksittainen kuva epaonnistuu, palautetaan undefined (IMAGE-04: ei rikkinaisia kuva-tageja).
 */
export async function generateDigestImages(
  imagePrompts: ImagePrompts
): Promise<{ heroUrl: string | undefined; sectionUrls: (string | undefined)[] }> {
  // Hero-kuva (1200x630)
  let heroUrl: string | undefined;
  try {
    heroUrl = (await generateImage(imagePrompts.heroPrompt, 1200, 630)) ?? undefined;
  } catch (error) {
    console.error('Hero image generation failed:', error);
    heroUrl = undefined;
  }

  // Osioiden kuvat (800x450) -- perakkkain, ei rinnakkain
  const sectionUrls: (string | undefined)[] = [];
  for (const prompt of imagePrompts.sectionPrompts) {
    try {
      const result = await generateImage(prompt, 800, 450);
      sectionUrls.push(result ?? undefined);
    } catch (error) {
      console.error('Section image generation failed:', error);
      sectionUrls.push(undefined);
    }
  }

  return { heroUrl, sectionUrls };
}
