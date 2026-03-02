// Digest-sisallon tyypit ja JSON-skeemat Claude-strukturoituja tulosteita varten

// --- TypeScript-tyypit ---

export interface DigestStory {
  title: string;
  businessImpact: string;
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
    intro: { type: 'string' as const, description: 'Opening paragraph' },
    stories: {
      type: 'array' as const,
      description: 'Between 3 and 5 news stories',
      items: {
        type: 'object' as const,
        properties: {
          title: { type: 'string' as const },
          businessImpact: { type: 'string' as const },
          sourceUrl: { type: 'string' as const },
        },
        required: ['title', 'businessImpact', 'sourceUrl'] as const,
        additionalProperties: false,
      },
    },
    closing: { type: 'string' as const, description: 'Closing paragraph' },
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
