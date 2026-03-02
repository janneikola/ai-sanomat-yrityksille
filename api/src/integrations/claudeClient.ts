import Anthropic from '@anthropic-ai/sdk';
import type { DigestContent, ValidationReport, ImagePrompts } from '../types/digest.js';
import {
  digestJsonSchema,
  validationJsonSchema,
  imagePromptsJsonSchema,
} from '../types/digest.js';

const client = new Anthropic();

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';

/**
 * Generoi viikkokatsauksen sisalto kayttaen Claude-strukturoitua tulostetta.
 * Palauttaa taatun DigestContent-JSON-rakenteen.
 */
export async function generateDigest(
  systemPrompt: string,
  userPrompt: string
): Promise<DigestContent> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: {
        format: {
          type: 'json_schema' as const,
          schema: digestJsonSchema,
        },
      },
    });

    const textBlock = response.content[0];
    if (textBlock.type !== 'text') {
      throw new Error('Claude did not return a text block');
    }
    return JSON.parse(textBlock.text) as DigestContent;
  } catch (error) {
    console.error('Digest generation failed:', error);
    throw new Error(
      `Digest generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validoi generoitu katsaus: faktatarkistus + suomen kielen laatu (humanizer 26 patternia).
 * Palauttaa taatun ValidationReport-JSON-rakenteen.
 */
export async function validateDigest(
  systemPrompt: string,
  userPrompt: string
): Promise<ValidationReport> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: {
        format: {
          type: 'json_schema' as const,
          schema: validationJsonSchema,
        },
      },
    });

    const textBlock = response.content[0];
    if (textBlock.type !== 'text') {
      throw new Error('Claude did not return a text block');
    }
    return JSON.parse(textBlock.text) as ValidationReport;
  } catch (error) {
    console.error('Digest validation failed:', error);
    throw new Error(
      `Digest validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generoi kuvapromptit katsauksen osioille.
 * Palauttaa taatun ImagePrompts-JSON-rakenteen.
 */
export async function generateImagePrompts(
  systemPrompt: string,
  userPrompt: string
): Promise<ImagePrompts> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: {
        format: {
          type: 'json_schema' as const,
          schema: imagePromptsJsonSchema,
        },
      },
    });

    const textBlock = response.content[0];
    if (textBlock.type !== 'text') {
      throw new Error('Claude did not return a text block');
    }
    return JSON.parse(textBlock.text) as ImagePrompts;
  } catch (error) {
    console.error('Image prompt generation failed:', error);
    throw new Error(
      `Image prompt generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
