import { GoogleGenAI } from '@google/genai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const IMAGE_STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || './uploads';

/**
 * Generoi kuva Gemini 2.5 Flash Image -mallilla ja tallenna tiedostojarjestelmaan.
 * Palauttaa julkisen URL-polun tai null jos kuvaa ei saatu.
 */
export async function generateImage(
  prompt: string,
  _width: number,
  _height: number
): Promise<string | null> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) return null;

  for (const part of parts) {
    if (part.inlineData) {
      const filename = `${crypto.randomUUID()}.png`;
      const imageDir = path.join(IMAGE_STORAGE_PATH, 'images');
      const filepath = path.join(imageDir, filename);
      fs.mkdirSync(imageDir, { recursive: true });
      fs.writeFileSync(filepath, Buffer.from(part.inlineData.data!, 'base64'));
      return `/images/${filename}`;
    }
  }

  return null;
}
