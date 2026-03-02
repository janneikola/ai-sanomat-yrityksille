import type { ImagePrompts } from '../types/digest.js';
import { generateImage, PLACEHOLDER_IMAGE_URL } from '../integrations/geminiClient.js';

/**
 * Generoi kaikki katsauksen kuvat: hero-kuva + osioiden kuvat.
 * Kukin generoidaan perakkkain (ei Promise.all) Geminin nopeusrajoitusten valttamiseksi.
 * Jos yksittainen kuva epaonnistuu, kaytetaan placeholder-kuvaa.
 */
export async function generateDigestImages(
  imagePrompts: ImagePrompts
): Promise<{ heroUrl: string; sectionUrls: string[] }> {
  // Hero-kuva (1200x630)
  let heroUrl: string;
  try {
    const result = await generateImage(imagePrompts.heroPrompt, 1200, 630);
    heroUrl = result ?? PLACEHOLDER_IMAGE_URL;
  } catch (error) {
    console.error('Hero image generation failed, using placeholder:', error);
    heroUrl = PLACEHOLDER_IMAGE_URL;
  }

  // Osioiden kuvat (800x450) -- perakkkain, ei rinnakkain
  const sectionUrls: string[] = [];
  for (const prompt of imagePrompts.sectionPrompts) {
    try {
      const result = await generateImage(prompt, 800, 450);
      sectionUrls.push(result ?? PLACEHOLDER_IMAGE_URL);
    } catch (error) {
      console.error('Section image generation failed, using placeholder:', error);
      sectionUrls.push(PLACEHOLDER_IMAGE_URL);
    }
  }

  return { heroUrl, sectionUrls };
}
