// Digest-sisallon tyypit ja JSON-skeemat Claude-strukturoituja tulosteita varten

// --- TypeScript-tyypit ---

// Structured content blocks (Phase 12 will generate these)
export interface LeadBlock {
  type: 'lead';
  text: string;
}

export interface BulletsBlock {
  type: 'bullets';
  items: string[];
}

export type ContentBlock = LeadBlock | BulletsBlock;

export interface DigestStory {
  title: string;
  lead: string;
  contentBlocks: ContentBlock[];
  businessImpact: string;       // Varakappale taaksepainyhteensopivuutta varten
  sourceUrl: string;
}

export interface DigestContent {
  intro: string;
  stories: DigestStory[];
  closing: string;
}

export interface AiPatternFlag {
  patternId: number;
  patternName: string;
  example: string;
  suggestion: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: string[];
  suggestions: string[];
  languageQuality: {
    score: number;
    aiPatternFlags: AiPatternFlag[];
  };
}

export interface ImagePrompts {
  heroPrompt: string;
  sectionPrompts: string[];
}

// --- JSON-skeemat (Claude structured outputs) ---
// Jokainen objektitaso vaatii additionalProperties: false
// ja kaikki ominaisuudet required-taulukossa

export const digestJsonSchema = {
  type: 'object' as const,
  properties: {
    intro: { type: 'string' as const, description: 'Opening paragraph, 100-150 words' },
    stories: {
      type: 'array' as const,
      description: '5 to 7 news stories with structured content',
      items: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' as const, description: 'News headline in Finnish' },
          lead: { type: 'string' as const, description: 'Bold intro paragraph, 2-3 sentences (40-60 words). Rendered as emphasized text below the title.' },
          contentBlocks: {
            type: 'array' as const,
            description: 'REQUIRED: At least one bullets block with 4-6 detailed items. Each item is 1-2 full sentences. This is the main body of the story.',
            items: {
              type: 'object' as const,
              properties: {
                type: { type: 'string' as const, enum: ['bullets'] },
                items: { type: 'array' as const, items: { type: 'string' as const }, description: '4-6 informative bullet points, each 1-2 sentences' },
              },
              required: ['type', 'items'] as const,
              additionalProperties: false,
            },
          },
          businessImpact: { type: 'string' as const, description: 'Fallback text (3-4 sentences) shown only if lead is missing. Still required for backward compatibility.' },
          sourceUrl: { type: 'string' as const, description: 'Exact URL from the provided news list' },
        },
        required: ['title', 'lead', 'contentBlocks', 'businessImpact', 'sourceUrl'] as const,
        additionalProperties: false,
      },
    },
    closing: { type: 'string' as const, description: 'Closing paragraph with trends summary and recommendations, 80-120 words' },
  },
  required: ['intro', 'stories', 'closing'] as const,
  additionalProperties: false,
};

export const validationJsonSchema = {
  type: 'object' as const,
  properties: {
    valid: { type: 'boolean' as const },
    issues: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    suggestions: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    languageQuality: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const, description: 'Quality score 1-10' },
        aiPatternFlags: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              patternId: {
                type: 'number' as const,
                description: 'Pattern number 1-26',
              },
              patternName: { type: 'string' as const },
              example: {
                type: 'string' as const,
                description: 'Text fragment exhibiting the pattern',
              },
              suggestion: {
                type: 'string' as const,
                description: 'How to fix it',
              },
            },
            required: [
              'patternId',
              'patternName',
              'example',
              'suggestion',
            ] as const,
            additionalProperties: false,
          },
        },
      },
      required: ['score', 'aiPatternFlags'] as const,
      additionalProperties: false,
    },
  },
  required: [
    'valid',
    'issues',
    'suggestions',
    'languageQuality',
  ] as const,
  additionalProperties: false,
};

export interface FeaturedPost {
  title: string;
  url: string;
  summary: string | null;
}

export const imagePromptsJsonSchema = {
  type: 'object' as const,
  properties: {
    heroPrompt: { type: 'string' as const },
    sectionPrompts: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['heroPrompt', 'sectionPrompts'] as const,
  additionalProperties: false,
};
