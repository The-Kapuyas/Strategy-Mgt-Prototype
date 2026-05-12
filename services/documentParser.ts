/**
 * LLM-Assisted Document Parsing Service
 * 
 * Pipeline stages:
 * 1. Upload - File is read as text
 * 2. Normalize - Clean up formatting, remove noise
 * 3. Chunk - Break into manageable sections
 * 4. Extract - Use LLM to extract structured data
 * 5. Validate - Verify extracted data quality
 * 6. Store - Return validated data for use
 */

import OpenAI from 'openai';

// Direct client for local dev (API key available client-side)
const parserApiKey = import.meta.env.VITE_OPENAI_API_KEY;
const directClient = parserApiKey
  ? new OpenAI({ apiKey: parserApiKey, dangerouslyAllowBrowser: true })
  : null;

// Dual-mode: direct OpenAI in dev, serverless proxy in production
async function callParserCompletion(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  response_format?: { type: string };
}): Promise<any> {
  if (directClient) {
    return directClient.chat.completions.create(params as any);
  }

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `AI proxy error: ${res.status}`);
  }

  return res.json();
}

export interface ExtractedCompanyContext {
  companyName: string | null;
  description: string | null;
  industry: string | null;
  stage: string | null;
  goals: string | null;
  challenges: string | null;
  confidence: {
    companyName: number;
    description: number;
    industry: number;
    stage: number;
    goals: number;
    challenges: number;
  };
}

export interface ParseResult {
  success: boolean;
  data: ExtractedCompanyContext;
  error?: string;
}

// Stage 1 & 2: Normalize - Clean up the document text
function normalizeDocument(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ ]{3,}/g, '  ')
    .replace(/\n{4,}/g, '\n\n\n')
    // Remove common markdown artifacts
    .replace(/^[-=]{3,}$/gm, '')
    .replace(/^\|.*\|$/gm, '') // Remove table rows
    // Remove URLs (they don't help with extraction)
    .replace(/https?:\/\/[^\s]+/g, '[URL]')
    // Remove email addresses
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]')
    // Normalize bullet points
    .replace(/^[○●◆◇▪▫►▻]/gm, '•')
    .replace(/^(\d+)\./gm, '$1)')
    .trim();
}

// Stage 3: Chunk - Break document into sections for processing
function chunkDocument(text: string, maxChunkSize: number = 4000): string[] {
  // If document is small enough, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const sections = text.split(/\n\n+/);
  let currentChunk = '';

  for (const section of sections) {
    if (currentChunk.length + section.length + 2 <= maxChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If a single section is too large, truncate it
      currentChunk = section.length > maxChunkSize 
        ? section.substring(0, maxChunkSize) 
        : section;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Stage 4: Extract - Use LLM to extract structured data
async function extractWithLLM(documentText: string): Promise<ExtractedCompanyContext> {
  const systemPrompt = `You are an expert at extracting structured information from business documents.
Your task is to extract specific company information from the provided document.

For each field, provide:
1. The extracted value (or null if not found)
2. A confidence score from 0 to 1 (0 = not found/guessing, 1 = explicitly stated)

IMPORTANT RULES:
- Only extract information that is CLEARLY present in the document
- If information is not found or unclear, return null for that field
- Do NOT make assumptions or infer information that isn't stated
- For "companyName", extract the official company/organization name (not product names or taglines)
- For "stage", only use these exact values: Pre-seed, Seed, Series A, Series B, Series C+, Growth, Enterprise
- For "description", provide a concise 1-3 sentence company overview
- For "goals" and "challenges", format as bullet points if multiple items

Return a JSON object with this exact structure:
{
  "companyName": "string or null",
  "description": "string or null",
  "industry": "string or null", 
  "stage": "string or null",
  "goals": "string or null",
  "challenges": "string or null",
  "confidence": {
    "companyName": 0.0-1.0,
    "description": 0.0-1.0,
    "industry": 0.0-1.0,
    "stage": 0.0-1.0,
    "goals": 0.0-1.0,
    "challenges": 0.0-1.0
  }
}`;

  const userPrompt = `Extract company information from this document:

---
${documentText}
---

Return ONLY valid JSON, no other text.`;

  try {
    const response = await callParserCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    const parsed = JSON.parse(content) as ExtractedCompanyContext;
    return parsed;
  } catch (error) {
    console.error('LLM extraction failed:', error);
    // Return empty result on failure
    return {
      companyName: null,
      description: null,
      industry: null,
      stage: null,
      goals: null,
      challenges: null,
      confidence: {
        companyName: 0,
        description: 0,
        industry: 0,
        stage: 0,
        goals: 0,
        challenges: 0
      }
    };
  }
}

// Stage 5: Validate - Verify extracted data quality
function validateExtraction(data: ExtractedCompanyContext): ExtractedCompanyContext {
  const validated = { ...data };
  
  // Validate company name - should be reasonable length
  if (validated.companyName && (validated.companyName.length < 2 || validated.companyName.length > 100)) {
    validated.companyName = null;
    validated.confidence.companyName = 0;
  }
  
  // Validate stage - must be one of allowed values
  const validStages = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Growth', 'Enterprise'];
  if (validated.stage && !validStages.includes(validated.stage)) {
    // Try to normalize the stage value
    const normalizedStage = validated.stage.toLowerCase();
    if (normalizedStage.includes('pre-seed') || normalizedStage.includes('preseed')) {
      validated.stage = 'Pre-seed';
    } else if (normalizedStage.includes('series a')) {
      validated.stage = 'Series A';
    } else if (normalizedStage.includes('series b')) {
      validated.stage = 'Series B';
    } else if (normalizedStage.includes('series c') || normalizedStage.includes('series d')) {
      validated.stage = 'Series C+';
    } else if (normalizedStage === 'seed') {
      validated.stage = 'Seed';
    } else if (normalizedStage.includes('growth')) {
      validated.stage = 'Growth';
    } else if (normalizedStage.includes('enterprise')) {
      validated.stage = 'Enterprise';
    } else {
      validated.stage = null;
      validated.confidence.stage = 0;
    }
  }

  // Validate description length
  if (validated.description && validated.description.length < 20) {
    validated.description = null;
    validated.confidence.description = 0;
  }

  // Validate industry - should be reasonable length
  if (validated.industry && (validated.industry.length < 3 || validated.industry.length > 50)) {
    validated.industry = null;
    validated.confidence.industry = 0;
  }

  // Apply confidence threshold - only keep high-confidence extractions
  const CONFIDENCE_THRESHOLD = 0.5;
  if (validated.confidence.companyName < CONFIDENCE_THRESHOLD) validated.companyName = null;
  if (validated.confidence.description < CONFIDENCE_THRESHOLD) validated.description = null;
  if (validated.confidence.industry < CONFIDENCE_THRESHOLD) validated.industry = null;
  if (validated.confidence.stage < CONFIDENCE_THRESHOLD) validated.stage = null;
  if (validated.confidence.goals < CONFIDENCE_THRESHOLD) validated.goals = null;
  if (validated.confidence.challenges < CONFIDENCE_THRESHOLD) validated.challenges = null;

  return validated;
}

// Merge multiple chunk extractions into one
function mergeExtractions(extractions: ExtractedCompanyContext[]): ExtractedCompanyContext {
  const merged: ExtractedCompanyContext = {
    companyName: null,
    description: null,
    industry: null,
    stage: null,
    goals: null,
    challenges: null,
    confidence: {
      companyName: 0,
      description: 0,
      industry: 0,
      stage: 0,
      goals: 0,
      challenges: 0
    }
  };

  for (const extraction of extractions) {
    // Keep the extraction with highest confidence for each field
    if (extraction.companyName && extraction.confidence.companyName > merged.confidence.companyName) {
      merged.companyName = extraction.companyName;
      merged.confidence.companyName = extraction.confidence.companyName;
    }
    if (extraction.description && extraction.confidence.description > merged.confidence.description) {
      merged.description = extraction.description;
      merged.confidence.description = extraction.confidence.description;
    }
    if (extraction.industry && extraction.confidence.industry > merged.confidence.industry) {
      merged.industry = extraction.industry;
      merged.confidence.industry = extraction.confidence.industry;
    }
    if (extraction.stage && extraction.confidence.stage > merged.confidence.stage) {
      merged.stage = extraction.stage;
      merged.confidence.stage = extraction.confidence.stage;
    }
    if (extraction.goals && extraction.confidence.goals > merged.confidence.goals) {
      merged.goals = extraction.goals;
      merged.confidence.goals = extraction.confidence.goals;
    }
    if (extraction.challenges && extraction.confidence.challenges > merged.confidence.challenges) {
      merged.challenges = extraction.challenges;
      merged.confidence.challenges = extraction.confidence.challenges;
    }
  }

  return merged;
}

/**
 * Main parsing function - orchestrates the full pipeline
 * Upload → Normalize → Chunk → Extract → Validate → Store
 */
export async function parseStrategyDocument(rawText: string): Promise<ParseResult> {
  try {
    // Stage 2: Normalize
    const normalizedText = normalizeDocument(rawText);
    
    if (normalizedText.length < 50) {
      return {
        success: false,
        data: {
          companyName: null,
          description: null,
          industry: null,
          stage: null,
          goals: null,
          challenges: null,
          confidence: { companyName: 0, description: 0, industry: 0, stage: 0, goals: 0, challenges: 0 }
        },
        error: 'Document too short to extract meaningful information'
      };
    }

    // Stage 3: Chunk
    const chunks = chunkDocument(normalizedText);
    
    // Stage 4: Extract (process chunks, but limit to first 2 for efficiency)
    const chunksToProcess = chunks.slice(0, 2);
    const extractions = await Promise.all(
      chunksToProcess.map(chunk => extractWithLLM(chunk))
    );

    // Merge extractions from multiple chunks
    const merged = mergeExtractions(extractions);

    // Stage 5: Validate
    const validated = validateExtraction(merged);

    // Stage 6: Return for storage
    return {
      success: true,
      data: validated
    };
  } catch (error) {
    console.error('Document parsing failed:', error);
    return {
      success: false,
      data: {
        companyName: null,
        description: null,
        industry: null,
        stage: null,
        goals: null,
        challenges: null,
        confidence: { companyName: 0, description: 0, industry: 0, stage: 0, goals: 0, challenges: 0 }
      },
      error: error instanceof Error ? error.message : 'Unknown error during parsing'
    };
  }
}

/**
 * Quick check if API key is available
 */
export function isLLMParsingAvailable(): boolean {
  // Available via direct client (dev) or proxy (production)
  return !!parserApiKey || typeof window !== 'undefined';
}
