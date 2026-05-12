import OpenAI from 'openai';
import { API_CONFIG, OKR_GUIDELINES } from '../constants';
import { getApiKey, logApiKeyStatus } from '../utils/apiKeyManager';
import { logger } from '../utils/logger';
import { SCHEMAS } from '../utils/schemas';
import { APIError } from '../types/api';
import type { JSONSchema } from '../types/api';
import type { SourceDocument } from '../types/checkin';

// Initialize API key (available in dev, undefined in production)
const apiKey = getApiKey();

// Log API key status
logApiKeyStatus(apiKey, {
  keyName: 'OpenAI',
  envVarNames: ['OPENAI_API_KEY'],
  instructionsUrl: 'https://platform.openai.com/api-keys',
});

// Direct client for local dev (API key available client-side)
const directClient = apiKey
  ? new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    })
  : null;

// Dual-mode: direct OpenAI in dev, serverless proxy in production
async function callChatCompletion(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
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
    throw new APIError(err.error || `AI proxy error: ${res.status}`);
  }

  return res.json();
}

/**
 * Generate AI response with JSON schema validation
 */
/**
 * Convert a JSON schema to a simple example format for the AI prompt
 */
function schemaToExample(schema: JSONSchema): any {
  if (schema.type === 'object' && schema.properties) {
    const example: any = {};
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      example[key] = schemaToExample(propSchema as JSONSchema);
    }
    return example;
  }
  if (schema.type === 'array') {
    const itemSchema = schema.items as JSONSchema;
    if (itemSchema?.type === 'object') {
      return [schemaToExample(itemSchema)];
    }
    return ['example_item'];
  }
  if (schema.type === 'string') return 'string_value';
  if (schema.type === 'number') return 0;
  if (schema.type === 'boolean') return true;
  return null;
}

async function generateWithSchema<T>(
  prompt: string,
  schema: JSONSchema
): Promise<T | null> {
  try {
    // Convert schema to a simple example format
    const exampleFormat = schemaToExample(schema);

    logger.info('Calling OpenAI API:', { model: API_CONFIG.MODEL, prompt: prompt.substring(0, 100) + '...' });

    const response = await callChatCompletion({
      model: API_CONFIG.MODEL,
      messages: [
        {
          role: 'system',
          content: API_CONFIG.SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `${prompt}\n\nRespond with valid JSON matching this structure (replace placeholder values with actual data):\n${JSON.stringify(exampleFormat, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: API_CONFIG.TEMPERATURE,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new APIError('No content in API response');
    }

    let parsed = JSON.parse(content) as T;
    
    // Handle case where API returns schema-wrapped response
    // Only unwrap if it looks like a JSON schema structure with 'required' array
    const rawParsed = parsed as any;
    if (rawParsed.properties && rawParsed.type === 'object' && Array.isArray(rawParsed.required)) {
      logger.info('Unwrapping schema-wrapped response');
      parsed = rawParsed.properties as T;
    }
    
    logger.info('API response parsed successfully:', parsed);
    
    return parsed;
  } catch (error) {
    handleAPIError(error);
    return null;
  }
}

/**
 * Centralized API error handling
 */
function handleAPIError(error: unknown): void {
  if (error instanceof APIError) {
    logger.error('API Error:', error.message);
    return;
  }

  if (error && typeof error === 'object') {
    const err = error as any;
    
    logger.error('Error generating AI content:', {
      status: err.status,
      message: err.message,
      details: err.error,
    });

    if (err.status === 401) {
      logger.error('Authentication failed. Please check your API key.');
    } else if (err.status === 429) {
      logger.error('Rate limit exceeded. Please wait before retrying.');
    } else if (err.status === 400) {
      logger.error('Invalid request format.');
    }
  } else {
    logger.error('Unknown error:', error);
  }
}

/**
 * Helper to extract array from response
 */
function extractArray<T>(result: any, key: string): T[] {
  return result && Array.isArray(result[key]) ? result[key] : [];
}

/**
 * Helper to extract string from response
 */
function extractString(result: any, key: string, defaultValue = ''): string {
  return result && typeof result[key] === 'string' ? result[key] : defaultValue;
}

// ============================================================================
// Company Research Types
// ============================================================================

export interface CompanyResearch {
  companyDescription: string;
  industry: string;
  stage: string;
  products: string[];
  targetMarket: string;
  competitors: string[];
  challenges: string[];
  opportunities: string[];
}

// Cache for company research to avoid redundant API calls
const researchCache = new Map<string, CompanyResearch>();

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Research a company to gather context for better OKR suggestions
 */
export async function researchCompany(companyName: string): Promise<CompanyResearch | null> {
  // Check cache first
  const cached = researchCache.get(companyName.toLowerCase());
  if (cached) {
    logger.info('Using cached research for:', companyName);
    return cached;
  }

  logger.info('Researching company:', companyName);
  
  const prompt = `
    Research the company "${companyName}" and provide detailed information to help create effective OKRs.
    
    If you know about this specific company, provide accurate information about them.
    If you don't have specific information about "${companyName}", make reasonable assumptions based on:
    - The company name and what it might suggest about their business
    - Common patterns for companies with similar names
    - Typical characteristics of tech/growth companies
    
    Be specific and detailed in your research to help generate relevant OKRs (Objectives and Key Results).
  `;
  
  const result = await generateWithSchema<CompanyResearch>(prompt, SCHEMAS.companyResearch);
  
  if (result) {
    // Log the specific fields we received
    logger.info('Company research completed:', {
      companyDescription: result.companyDescription?.substring(0, 50) + '...',
      industry: result.industry,
      stage: result.stage,
      targetMarket: result.targetMarket?.substring(0, 50) + '...',
    });
    
    // Cache the result
    researchCache.set(companyName.toLowerCase(), result);
  }
  
  return result;
}

/**
 * Company context for AI suggestions
 */
export interface CompanyContext {
  description: string;
  industry: string;
  stage: string;
  goals: string;
  challenges: string;
}

/**
 * Objective suggestion with reasoning for explainability
 */
export interface ObjectiveSuggestion {
  title: string;
  reasoning: string;
}

export interface ObjectiveSuggestionsResult {
  objectives: ObjectiveSuggestion[];
  overallRationale: string;
}

/**
 * Suggest Objectives following OKR best practices
 * 
 * OKR Best Practices for Objectives:
 * - Qualitative, not quantitative (no numbers)
 * - Inspirational and memorable
 * - Time-bound (quarterly or annual)
 * - Aligned with company mission
 */
export async function suggestObjectives(companyName: string, companyContext?: CompanyContext): Promise<ObjectiveSuggestionsResult> {
  // ALWAYS do web research to get additional context
  logger.info('Researching company via web search:', companyName);
  const research = await researchCompany(companyName);
  
  // Build combined context from BOTH web research AND user-provided info
  let contextBlock = '';
  
  // Add web research context
  if (research) {
    contextBlock += `
      WEB RESEARCH FINDINGS:
      - Description: ${research.companyDescription || 'N/A'}
      - Industry: ${research.industry || 'N/A'}
      - Stage: ${research.stage || 'N/A'}
      - Products/Services: ${(research.products || []).join(', ') || 'N/A'}
      - Target Market: ${research.targetMarket || 'N/A'}
      - Key Challenges: ${(research.challenges || []).join(', ') || 'N/A'}
      - Opportunities: ${(research.opportunities || []).join(', ') || 'N/A'}
    `;
  }
  
  // Add user-provided context (takes priority for any overlapping info)
  if (companyContext && (companyContext.description || companyContext.industry || companyContext.stage || companyContext.goals || companyContext.challenges)) {
    contextBlock += `
      
      USER-PROVIDED CONTEXT (prioritize this over web research):
      ${companyContext.description ? `- Company Description: ${companyContext.description}` : ''}
      ${companyContext.industry ? `- Industry: ${companyContext.industry}` : ''}
      ${companyContext.stage ? `- Stage: ${companyContext.stage}` : ''}
      ${companyContext.goals ? `- Strategic Goals for This Year: ${companyContext.goals}` : ''}
      ${companyContext.challenges ? `- Current Challenges & Focus Areas: ${companyContext.challenges}` : ''}
    `;
    logger.info('Combining web research with user-provided context');
  }

  const prompt = contextBlock
    ? `
      You are an expert OKR coach helping "${companyName}" define their Objectives.
      ${contextBlock}
      
      IMPORTANT: When user-provided context is available, prioritize it over web research findings as it reflects the company's current priorities.
      
      OKR BEST PRACTICES FOR OBJECTIVES:
      ${OKR_GUIDELINES.OBJECTIVES.rules.map(r => `- ${r}`).join('\n')}
      
      GOOD OBJECTIVE EXAMPLES:
      ${OKR_GUIDELINES.OBJECTIVES.examples.map(e => `- "${e}"`).join('\n')}
      
      Generate 3-4 Objectives that are:
      1. Qualitative and inspiring (NO numbers or metrics)
      2. Specific to ${companyName}'s industry and stage
      3. Aligned with addressing their challenges and capturing opportunities
      4. Directly relevant to their stated strategic goals (if provided)
      5. Memorable and motivating for the team
      6. Achievable within 12-18 months
      
      Each objective should start with an action verb and be concise (under 10 words is ideal).
      
      For each objective, provide a brief reasoning (1-2 sentences) explaining WHY this objective is relevant based on the company's situation.
      Also provide an overall rationale explaining the strategic thinking behind these suggestions.
    `
    : `
      You are an expert OKR coach. Suggest 3-4 inspiring Objectives for a company called "${companyName}".
      
      OKR BEST PRACTICES FOR OBJECTIVES:
      ${OKR_GUIDELINES.OBJECTIVES.rules.map(r => `- ${r}`).join('\n')}
      
      Each objective should be qualitative, inspiring, and achievable within 12-18 months.
      For each objective, provide a brief reasoning explaining WHY it's appropriate.
      Also provide an overall rationale explaining the strategic thinking behind these suggestions.
    `;
  
  logger.info('Generating objectives with OKR best practices...');
  
  const result = await generateWithSchema<{ 
    objectives: ObjectiveSuggestion[]; 
    overallRationale: string;
  }>(
    prompt,
    SCHEMAS.objectives
  );
  
  logger.info('Objective generation result:', result);
  
  const objectives = extractArray<ObjectiveSuggestion>(result, 'objectives');
  const overallRationale = extractString(result, 'overallRationale', 'Based on company analysis and OKR best practices.');
  
  logger.info('Extracted objectives:', objectives);
  
  return { objectives, overallRationale };
}

// Legacy alias for backward compatibility
export const suggestPriorities = suggestObjectives;

/**
 * Get cached research for a company (if available)
 */
export function getCachedResearch(companyName: string): CompanyResearch | null {
  return researchCache.get(companyName.toLowerCase()) || null;
}

/**
 * Clear research cache
 */
export function clearResearchCache(): void {
  researchCache.clear();
}

/**
 * Key Result response type with metrics and reasoning
 */
export interface KeyResultSuggestion {
  title: string;
  metric: string;
  target: string;
  reasoning: string;
}

/**
 * Suggest Key Results following OKR best practices
 * 
 * OKR Best Practices for Key Results:
 * - Quantitative and measurable (always include numbers)
 * - Specific with clear targets
 * - Ambitious but achievable (70% completion = success)
 * - 3-5 Key Results per Objective
 */
export async function suggestKeyResults(
  objectiveTitle: string,
  companyName: string,
  companyContext?: CompanyContext
): Promise<KeyResultSuggestion[]> {
  // Build context block combining cached research AND user-provided context
  let contextBlock = '';
  
  // Use cached research (from when objectives were generated)
  const research = getCachedResearch(companyName);
  if (research) {
    contextBlock += `
      WEB RESEARCH FINDINGS:
      - Industry: ${research.industry || 'N/A'}
      - Stage: ${research.stage || 'N/A'}
      - Products: ${(research.products || []).join(', ') || 'N/A'}
      - Target Market: ${research.targetMarket || 'N/A'}
      - Key Challenges: ${(research.challenges || []).join(', ') || 'N/A'}
    `;
  }
  
  // Add user-provided context (takes priority)
  if (companyContext && (companyContext.description || companyContext.industry || companyContext.stage || companyContext.goals || companyContext.challenges)) {
    contextBlock += `
      
      USER-PROVIDED CONTEXT (prioritize this):
      ${companyContext.industry ? `- Industry: ${companyContext.industry}` : ''}
      ${companyContext.stage ? `- Stage: ${companyContext.stage}` : ''}
      ${companyContext.description ? `- Description: ${companyContext.description.substring(0, 500)}` : ''}
      ${companyContext.goals ? `- Strategic Goals: ${companyContext.goals}` : ''}
      ${companyContext.challenges ? `- Key Challenges: ${companyContext.challenges}` : ''}
    `;
  }
  
  const prompt = contextBlock
    ? `
      You are an expert OKR coach helping "${companyName}" define Key Results.
      ${contextBlock}
      
      OBJECTIVE: "${objectiveTitle}"
      
      OKR BEST PRACTICES FOR KEY RESULTS:
      ${OKR_GUIDELINES.KEY_RESULTS.rules.map(r => `- ${r}`).join('\n')}
      
      GOOD KEY RESULT EXAMPLES:
      ${OKR_GUIDELINES.KEY_RESULTS.examples.map(e => `- "${e}"`).join('\n')}
      
      Generate 3-4 Key Results that:
      1. Are specific and measurable with clear numeric targets
      2. Would indicate progress toward achieving the objective
      3. Are ambitious but achievable (stretch goals)
      4. Can be tracked and measured objectively
      5. Include a baseline (current state) and target (desired state) where possible
      
      Each Key Result should follow the format: "Increase/Decrease/Achieve [metric] from [baseline] to [target]"
      For each Key Result, provide brief reasoning (1-2 sentences) explaining WHY this metric and target were chosen.
    `
    : `
      You are an expert OKR coach. Suggest 3-4 measurable Key Results for this Objective: "${objectiveTitle}"
      
      OKR BEST PRACTICES FOR KEY RESULTS:
      ${OKR_GUIDELINES.KEY_RESULTS.rules.map(r => `- ${r}`).join('\n')}
      
      Each Key Result must include specific numbers and measurable targets.
      For each Key Result, provide brief reasoning explaining the choice of metric and target.
    `;
  
  const result = await generateWithSchema<{ keyResults: KeyResultSuggestion[] }>(
    prompt,
    SCHEMAS.keyResults
  );
  
  return extractArray(result, 'keyResults');
}

/**
 * Legacy alias - converts new KeyResult format to simple string array
 */
export async function suggestInitiatives(
  priorityTitle: string,
  companyName: string
): Promise<string[]> {
  const keyResults = await suggestKeyResults(priorityTitle, companyName);
  return keyResults.map(kr => kr.title);
}

interface PersonnelForAI {
  name: string;
  role: string;
  department: string;
  skills?: string[];
  availability?: string;
}

/** @deprecated Use HeadcountSuggestion instead */
export interface ResourceSuggestion {
  label: string;
  value: string;
  reasoning: string;
}

/** @deprecated Use ProjectResourceSuggestionsResult instead */
export interface ResourceSuggestionsResult {
  resources: ResourceSuggestion[];
  summary: string;
}

export interface HeadcountSuggestion {
  name: string;
  role: string;
  allocation: string; // e.g., "Full-time", "Part-time", "50%"
  reasoning: string;
  personnelId?: string; // If matched from roster
}

export interface TimeframeSuggestion {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  durationMonths: number;
  reasoning: string;
}

export interface ProjectResourceSuggestionsResult {
  timeframe: TimeframeSuggestion;
  headcount: HeadcountSuggestion[];
  summary: string;
}

export async function suggestProjectResources(
  projectTitle: string,
  department: string,
  companyName: string,
  personnel?: PersonnelForAI[]
): Promise<ProjectResourceSuggestionsResult> {
  // Build personnel context if available
  let personnelContext = '';
  const personnelMap: Record<string, string> = {};
  
  if (personnel && personnel.length > 0) {
    const relevantPersonnel = personnel.filter(p => 
      p.department.toLowerCase() === department.toLowerCase() ||
      p.department.toLowerCase() === 'general'
    );
    const otherPersonnel = personnel.filter(p => 
      p.department.toLowerCase() !== department.toLowerCase() &&
      p.department.toLowerCase() !== 'general'
    );
    
    // Build a map for matching names to IDs
    personnel.forEach(p => {
      personnelMap[p.name.toLowerCase()] = p.name;
    });
    
    if (relevantPersonnel.length > 0 || otherPersonnel.length > 0) {
      personnelContext = `
      
      AVAILABLE TEAM MEMBERS (from company roster):
      ${relevantPersonnel.length > 0 ? `
      ${department} Department:
      ${relevantPersonnel.map(p => `- ${p.name} (${p.role})${p.skills?.length ? ` - Skills: ${p.skills.join(', ')}` : ''}${p.availability ? ` - ${p.availability}` : ''}`).join('\n')}
      ` : ''}
      ${otherPersonnel.length > 0 ? `
      Other Departments (available for cross-functional work):
      ${otherPersonnel.slice(0, 10).map(p => `- ${p.name} (${p.role}, ${p.department})${p.skills?.length ? ` - Skills: ${p.skills.join(', ')}` : ''}`).join('\n')}
      ` : ''}
      
      IMPORTANT: When suggesting headcount, prefer recommending specific people from this roster by name when their skills match the project needs. Use their exact names as provided.
      `;
    }
  }

  // Calculate reasonable dates (start from next month, typical 3-6 month projects)
  const today = new Date();
  const defaultStartDate = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString().split('T')[0];

  const prompt = `
    You are a resource planning expert for "${companyName}". 
    For the departmental project: "${projectTitle}" within the "${department}" department, 
    suggest the TIMEFRAME and HEADCOUNT requirements.
    ${personnelContext}
    
    Rules:
    1. TIMEFRAME:
       - Suggest realistic start and end dates (use ISO format YYYY-MM-DD)
       - Consider today is ${today.toISOString().split('T')[0]}
       - A reasonable start date might be ${defaultStartDate} or later
       - Provide reasoning for the timeline
    
    2. HEADCOUNT (2-4 people):
       - Suggest specific roles needed for this project
       ${personnel && personnel.length > 0 ? '- Use actual names from the roster when skills match' : '- Describe the role/expertise needed'}
       - Specify allocation: "Full-time", "Part-time", or percentage like "50%"
       - Provide reasoning for why each person/role is needed
    
    Return a structured response with timeframe and headcount.
  `;
  
  const result = await generateWithSchema<{
    timeframe: TimeframeSuggestion;
    headcount: HeadcountSuggestion[];
    summary: string;
  }>(prompt, SCHEMAS.projectResources);
  
  return {
    timeframe: result?.timeframe || {
      startDate: defaultStartDate,
      endDate: new Date(today.getFullYear(), today.getMonth() + 4, 1).toISOString().split('T')[0],
      durationMonths: 3,
      reasoning: 'Standard project timeline',
    },
    headcount: extractArray(result, 'headcount'),
    summary: extractString(result, 'summary', 'Resource allocation based on project requirements.'),
  };
}

/** @deprecated Use suggestProjectResources instead */
export async function suggestResources(
  projectTitle: string,
  department: string,
  companyName: string,
  personnel?: PersonnelForAI[]
): Promise<ResourceSuggestionsResult> {
  // Convert new format to old for backward compatibility
  const result = await suggestProjectResources(projectTitle, department, companyName, personnel);
  
  const resources: ResourceSuggestion[] = [
    {
      label: 'Timeframe',
      value: `${result.timeframe.durationMonths} months (${result.timeframe.startDate} to ${result.timeframe.endDate})`,
      reasoning: result.timeframe.reasoning,
    },
    ...result.headcount.map(h => ({
      label: h.role,
      value: `${h.name} (${h.allocation})`,
      reasoning: h.reasoning,
    })),
  ];
  
  return {
    resources,
    summary: result.summary,
  };
}

export interface ProjectSuggestion {
  department: string;
  title: string;
  reasoning: string;
}

export async function suggestDepartmentalProjects(
  keyResultTitle: string,
  companyName: string
): Promise<ProjectSuggestion[]> {
  // Use cached research if available
  const research = getCachedResearch(companyName);
  
  const prompt = research
    ? `
      For "${companyName}" (${research.industry || 'N/A'}, ${research.stage || 'N/A'}):
      
      Company Context:
      - Description: ${research.companyDescription || 'N/A'}
      - Products: ${(research.products || []).join(', ') || 'N/A'}
      
      Given the Key Result: "${keyResultTitle}"
      
      Suggest 3-4 departmental projects that different teams would need to execute to achieve this Key Result.
      Include projects for relevant departments like Product, Engineering, Marketing, Sales, People, etc.
      Make each project specific and achievable within 3-6 months.
      For each project, provide brief reasoning explaining WHY this project is needed and how it contributes to the Key Result.
    `
    : `Suggest 3-4 projects for Key Result "${keyResultTitle}" at "${companyName}". For each project, explain why it's needed.`;
  
  const result = await generateWithSchema<{
    projects: ProjectSuggestion[];
  }>(prompt, SCHEMAS.projects);
  
  return extractArray(result, 'projects');
}

export async function suggestInviteMessage(companyName: string): Promise<string> {
  // Use cached research if available
  const research = getCachedResearch(companyName);
  
  const prompt = research
    ? `
      Draft a professional invitation email for department heads to join "${companyName}" OKR planning workspace.
      
      Company Context:
      - ${research.companyDescription}
      - Industry: ${research.industry}
      - Stage: ${research.stage}
      
      The invite should:
      - Be professional but friendly
      - Mention the OKR (Objectives and Key Results) planning process
      - Explain how OKRs help align teams and track progress
      - Encourage participation from all departments
      - Be concise (2-3 paragraphs)
    `
    : `Draft an invite for department heads to join "${companyName}" OKR planning workspace.`;
  
  const result = await generateWithSchema<{ message: string }>(
    prompt,
    SCHEMAS.message
  );
  
  return extractString(result, 'message');
}

export interface RiskWithReasoning {
  risk: string;
  reasoning: string;
}

export interface FocusAreaWithReasoning {
  area: string;
  reasoning: string;
}

export interface ExecutionInsights {
  summary: string;
  risks: RiskWithReasoning[];
  focusAreas: FocusAreaWithReasoning[];
}

// ─── Leader Update Suggestions ───

export interface LeaderSuggestionChange {
  targetType: string;
  targetId: string;
  targetLabel: string;
  field: string;
  from: string;
  to: string;
  rationale?: string;
}

export interface LeaderSuggestionAction {
  title: string;
  description: string;
  bullets: string[];
  affectedEntityIds: string[];
  affectedEntityLabels: string[];
  severity: 'critical' | 'warning' | 'info';
}

export interface LeaderSuggestionItem {
  itemId: string;
  itemType: 'project' | 'keyResult';
  itemLabel: string;
  suggestedStatus: 'on_track' | 'at_risk' | 'blocked' | 'ahead' | 'done';
  rationale: string;
  flags?: string[];
  proposedActions?: LeaderSuggestionAction[];
  suggestedChanges?: LeaderSuggestionChange[];
  detailedAnalysis?: {
    outcome: { status: string; bullets: string[] };
    time: { status: string; bullets: string[] };
    executionHealth: { status: string; bullets: string[] };
  };
  verboseAssessment?: string;
  citedSourceDocumentIds?: string[];
}

export interface LeaderSuggestionsResult {
  items: LeaderSuggestionItem[];
  summary: string;
}

export async function generateLeaderSuggestions(
  leaderRole: string,
  companyName: string,
  portfolioContext: string,
  sourceDocuments?: SourceDocument[],
): Promise<LeaderSuggestionsResult> {
  const docsSection = sourceDocuments && sourceDocuments.length > 0
    ? `\n\nSOURCE DOCUMENTS (evidence from team communications, tools, and meetings):
${sourceDocuments.map(doc => `
--- [${doc.id}] ${doc.type.toUpperCase()}: ${doc.title} ---
Author: ${doc.author}${doc.authorRole ? ` (${doc.authorRole})` : ''}
Date: ${doc.date}
Citation URL: ${doc.url}
Related Items: ${doc.relatedItemIds.join(', ')}

${doc.content}
`).join('\n')}

IMPORTANT — Source document instructions:
- Use insights from these source documents to inform your status assessments, rationale, and proposed changes
- Reference specific evidence (dates, metrics, names, percentages) from the documents in your rationale
- For key result items with status "at_risk" or "blocked" that have relevant source documents, include a "detailedAnalysis" object
- Use the EXACT citation URLs provided for each document — do not modify or invent URLs
- Also include "citedSourceDocumentIds" listing the document IDs (e.g., "SD-001") you cited in the detailed analysis
- Do NOT include detailedAnalysis for on_track, ahead, or done items

DETAILED ANALYSIS FORMAT (structured three-dimension assessment for at-risk/blocked key result items):
Provide a "detailedAnalysis" object with three dimensions:

1. "outcome" — Is the KR currently where it should be relative to plan?
   Status values: "on_target", "partial", "missed"
   Include 2-3 bullets explaining the current state with specific metrics and evidence.

2. "time" — Does the KR still have enough runway to land by the deadline?
   Status values: "on_time", "delayed", "overdue"
   Include 2-3 bullets about timeline risks, date slippage, and deadline proximity.

3. "executionHealth" — Are supporting projects, owners, and dependencies healthy enough to deliver?
   Status values: "stable", "watch", "at_risk"
   Include 2-3 bullets about project health, resource constraints, and dependency status.

Each bullet is a string with:
- **bold** for key metrics, dates, names, and important conclusions
- Project/KR references like P1, P3, KR2.1 (rendered as interactive pills)
- Inline citations using [descriptive text](exact citation URL) for factual claims from source documents
- Be thorough — cite specific numbers, dates, team member names, and percentages`
    : '';

  const prompt = `
You are preparing a bi-weekly leadership check-in for "${companyName}".
You are analyzing the portfolio for the **${leaderRole}**.

Today's date is ${new Date().toISOString().split('T')[0]}.

Review each project and key result this leader owns. For each item:
1. Assess its health status based on progress, timeline, dependencies, and team utilization
2. Explain your reasoning with specific data points (progress %, dates, team names)
3. Flag any concerns: overallocation, stale progress, dependency risks, timeline risks
4. For items that need attention, propose high-level **actions** the leader should consider — NOT specific field-level mutations. These are directional recommendations that the leader will refine through follow-up conversation. Examples:
   - "Clarify priorities" — when actual work deviates from planned allocation, identify the key misalignments
   - "Rebalance staffing baseline" — when team members are over/under-allocated, recommend rebalancing direction
   - "Address timeline risk" — when dependencies or delays threaten deadlines, recommend escalation or scope adjustments
   - "Escalate dependency" — when cross-team blockers exist, recommend who to engage
   - "Address sentiment" — when team signals indicate morale or engagement concerns
   Each action should have a clear title, 2-3 sentence description with specific evidence, bullet points with key data points, and list the affected entity IDs.
   Include 1-3 proposed actions per at-risk or blocked item. Do NOT include concrete field-level changes (suggestedChanges) — those will be refined through conversation.

Be direct and specific. Reference actual numbers and names from the data.
When referencing projects or key results, always use "ID: Name" format (e.g., "P5: Build Mobile Platform", "KR2.1: Ship AI Workflow Builder").
Items that are genuinely on track can have brief rationale. Focus detail on items that need attention.

PORTFOLIO DATA:
${portfolioContext}${docsSection}
  `.trim();

  const result = await generateWithSchema<LeaderSuggestionsResult>(prompt, SCHEMAS.leaderSuggestions);

  return {
    items: extractArray(result, 'items'),
    summary: extractString(result, 'summary', 'Unable to generate portfolio assessment.'),
  };
}

// ─── Leader Item Collaborate Chat ───

export interface LeaderChatResponse {
  message: string;
  suggestedUpdates?: {
    status?: 'on_track' | 'at_risk' | 'blocked' | 'ahead' | 'done';
    narrative?: string;
    proposedChanges?: Array<{
      targetType: string;
      targetId: string;
      targetLabel: string;
      field: string;
      from: string;
      to: string;
      rationale?: string;
    }>;
  };
}

export async function chatWithLeaderItem(
  userMessage: string,
  itemContext: string,
  companyName: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
): Promise<LeaderChatResponse> {
  const systemPrompt = `You are an AI strategy assistant for "${companyName}" helping a department leader during their check-in preparation.

You are discussing a specific portfolio item. The leader may share context, concerns, or ask for help.

ITEM CONTEXT:
${itemContext}

INSTRUCTIONS:
- Respond conversationally but concisely.
- The leader may be refining a proposed action into concrete changes. When they confirm a direction or agree with an action, produce specific "proposedChanges" with targetType, targetId, targetLabel, field, from, to values. Ask clarifying questions if you need more information before proposing specific changes.
- If the leader's message implies a status change, narrative update, or plan change, include a "suggestedUpdates" object in your JSON response with the specific structured data.
- If the message is just conversational or a question, respond with only a "message" field.
- For proposed changes, use the structured format with targetType, targetId, targetLabel, field, from, to.
- Be specific — reference actual IDs, dates, and numbers from the context.
- If suggesting a status change, explain why in your message.

Respond with valid JSON matching this format:
{
  "message": "Your conversational response",
  "suggestedUpdates": {
    "status": "at_risk",
    "narrative": "Draft narrative text",
    "proposedChanges": [{ "targetType": "project", "targetId": "P5", "targetLabel": "...", "field": "end_date", "from": "2026-06-30", "to": "2026-08-15", "rationale": "..." }]
  }
}
Only include suggestedUpdates (or specific fields within it) when the leader's message warrants changes. Omit it entirely for pure Q&A.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const completion = await callChatCompletion({
    model: API_CONFIG.MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(raw);
    return {
      message: parsed.message || 'I could not generate a response.',
      suggestedUpdates: parsed.suggestedUpdates || undefined,
    };
  } catch {
    return { message: raw };
  }
}

export async function generateExecutionInsights(
  companyName: string,
  planJson: string
): Promise<ExecutionInsights> {
  const prompt = `
    Analyze this company's OKR strategy for "${companyName}": ${planJson}.
    
    Using OKR best practices, evaluate:
    - Are the Objectives qualitative and inspiring?
    - Are the Key Results measurable and ambitious?
    - Is there good alignment between Objectives and Key Results?
    
    Focus on potential bottlenecks in **Timeframe** and **Headcount** at the project level.
    Provide a brief strategic execution summary, 3 potential risks (with reasoning for each based on the data), and 3 immediate focus areas for the CEO (with reasoning for each).
    
    For each risk and focus area, explain WHY it's important based on specific observations from the OKR data.
  `;
  
  const result = await generateWithSchema<{
    summary: string;
    risks: RiskWithReasoning[];
    focusAreas: FocusAreaWithReasoning[];
  }>(prompt, SCHEMAS.insights);

  return {
    summary: extractString(result, 'summary', 'Unable to generate insights at this time.'),
    risks: extractArray(result, 'risks'),
    focusAreas: extractArray(result, 'focusAreas'),
  };
}

/**
 * Strategy Blueprint Chatbot - Answer questions about the OKR strategy
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithStrategy(
  question: string,
  strategyContext: string,
  companyName: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  try {
    // Build conversation history messages
    const historyMessages = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await callChatCompletion({
      model: API_CONFIG.MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an AI strategy assistant for "${companyName}". You help users understand, navigate, and optimize their OKR strategy.

Your knowledge includes:
- Strategic objectives, key results, departmental projects with status and progress
- Team members with roles, skills, departments, and allocation across projects
- personnelAnalysis: each person's peak allocation, available capacity, project breakdown, and over-allocation status
- Dependencies between projects (blocks, depends_on, relates_to)
- FTE-years and estimated cost per project
- Active assessment alerts (resource, timeline, alignment, coverage issues)

STRATEGY DATA:
${strategyContext}

RESPONSE GUIDELINES:

1. **Resource & staffing questions** (e.g. "Who should I add to Project X?"):
   - Check personnelAnalysis for people with matching skills and available capacity
   - Show each candidate's current allocation, skills, and available capacity %
   - Note impact on their other projects if they'd become over-allocated
   - If no one has capacity, suggest which project to deprioritize

2. **Impact analysis** (e.g. "What if we cancel Project X?"):
   - Identify FTE freed up: list each person, their role, and allocation % on that project
   - Check if freed people have other project assignments or become fully available
   - Check dependencies: what projects block or depend on this one
   - Trace up: which KR(s) and Objective(s) are affected, and if any KR loses its only project

3. **Dependencies**: Reference the dependencies data. Flag timeline conflicts.

4. **Navigation links**: Include 1-2 relevant links at the end of your response using this exact markdown syntax:
   - [View in Capacity](app://view/assignments?person=ExactPersonName) — someone's workload
   - [View Timeline](app://view/timeline) — project timelines
   - [View Allocation](app://view/allocation) — allocation overview
   - [View Assessment](app://view/assessment) — assessment alerts
   - [View Strategy Map](app://view/explorer) — strategy map
   - [View Department](app://view/department?dept=ExactDeptName) — department view
   Use exact person/department names from the data. Only add links when they genuinely help.

5. **Format**:
   - Lead with a direct answer (1-2 sentences)
   - Use bullet points (dashes) for details, indented dashes for sub-details
   - Bold (**text**) for names, figures, and key terms
   - End with recommendation + relevant view link(s)
   - Keep responses focused — only include what was asked about`,
        },
        ...historyMessages,
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.4,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return 'I apologize, but I was unable to generate a response. Please try again.';
    }

    return content;
  } catch (error) {
    handleAPIError(error);
    return 'I encountered an error while processing your question. Please try again.';
  }
}

// ============================================================================
// Objective Coverage Analysis
// ============================================================================

export interface KRSuggestion {
  title: string;
  metric: string;
  target: string;
  rationale: string;
}

export interface ObjectiveCoverageResult {
  objectiveId: string;
  objectiveTitle: string;
  coverageScore: 'sufficient' | 'partial' | 'insufficient';
  currentCoverage: string;
  missingDimensions: string[];
  suggestedKRs: KRSuggestion[];
  rationale: string;
}

interface ObjectiveForAnalysis {
  id: string;
  title: string;
  keyResults: { title: string; targetMetric?: string }[];
}

/**
 * Analyze whether each objective has sufficient KR coverage
 * Returns coverage analysis for objectives that need attention
 */
export async function analyzeObjectiveCoverage(
  objectives: ObjectiveForAnalysis[]
): Promise<ObjectiveCoverageResult[]> {
  if (objectives.length === 0) {
    return [];
  }

  const prompt = `Analyze each objective and its key results. Determine if the KRs are sufficient to achieve the objective.

For each objective, evaluate:
1. Coverage score: "sufficient" (KRs fully support objective), "partial" (some gaps), or "insufficient" (major gaps)
2. What the current KRs measure
3. What dimensions are missing (e.g., awareness, acquisition, retention, revenue, quality)
4. 1-3 specific KR suggestions to fill gaps (only if score is partial or insufficient)

OBJECTIVES AND KRS:
${objectives.map((obj, i) => `
O${i + 1} (id: ${obj.id}): "${obj.title}"
Current KRs:
${obj.keyResults.length > 0
  ? obj.keyResults.map((kr, j) => `  KR${j + 1}: "${kr.title}" (${kr.targetMetric || 'no metric'})`).join('\n')
  : '  (no KRs defined)'}
`).join('\n')}

Only return results for objectives with "partial" or "insufficient" coverage.
For sufficient objectives, do not include them in the response.

Respond with valid JSON:
{
  "analyses": [
    {
      "objectiveId": "the objective id",
      "objectiveTitle": "the objective title",
      "coverageScore": "partial or insufficient",
      "currentCoverage": "Brief description of what current KRs measure",
      "missingDimensions": ["dimension1", "dimension2"],
      "suggestedKRs": [
        {
          "title": "Specific KR title with metric and target",
          "metric": "The metric name",
          "target": "The target value",
          "rationale": "Why this KR helps achieve the objective"
        }
      ],
      "rationale": "Overall explanation of why this objective needs more KRs"
    }
  ]
}`;

  try {
    logger.info('Analyzing objective coverage...');

    const response = await callChatCompletion({
      model: API_CONFIG.MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an OKR expert analyzing whether objectives have sufficient key results to be achievable. Focus on identifying gaps and providing actionable suggestions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      logger.warn('No content in coverage analysis response');
      return [];
    }

    const parsed = JSON.parse(content) as { analyses: ObjectiveCoverageResult[] };
    const analyses = parsed.analyses || [];

    logger.info(`Coverage analysis complete: ${analyses.length} objectives need attention`);

    return analyses;
  } catch (error) {
    handleAPIError(error);
    return [];
  }
}

/**
 * Generate impact analysis for check-in brief items.
 * Analyzes proposed changes against the strategic plan in a single batch call.
 */
export async function generateImpactAnalysis(
  items: Array<{
    id: string;
    title: string;
    summary: string;
    rationale: string;
    changes: Array<{ targetLabel: string; field: string; from: string; to: string }>;
    severity: string;
    proposedBy: string;
  }>,
  objectivesContext: string,
): Promise<Array<{ id: string; impact: string }>> {
  try {
    const itemDescriptions = items.map((item, idx) => {
      const changesText = item.changes.length > 0
        ? item.changes.map(c => `  - ${c.targetLabel}: ${c.field} from "${c.from}" to "${c.to}"`).join('\n')
        : '  (no specific changes proposed)';
      return `Item ${idx + 1} [id: ${item.id}]
Title: ${item.title}
Severity: ${item.severity}
Proposed by: ${item.proposedBy}
Summary: ${item.summary}
Changes:
${changesText}`;
    }).join('\n\n');

    const prompt = `You are a strategic planning advisor analyzing proposed changes from a leadership check-in.

For each item below, write a concise impact analysis (1-2 sentences) that explains:
- Which objectives or key results are directly affected
- Timeline, resource, or dependency implications
- Any downstream risks or benefits to the broader plan

Be specific — reference actual objective/KR names from the strategic plan context. Be direct and actionable.

STRATEGIC PLAN CONTEXT:
${objectivesContext}

ITEMS TO ANALYZE:
${itemDescriptions}

Respond with JSON: { "impacts": [{ "id": "<item id>", "impact": "<impact statement>" }] }`;

    const response = await callChatCompletion({
      model: API_CONFIG.MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a strategic planning advisor. Analyze the impact of proposed changes on the broader strategic plan. Be concise and specific.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.warn('No content in impact analysis response');
      return [];
    }

    const parsed = JSON.parse(content) as { impacts: Array<{ id: string; impact: string }> };
    const impacts = parsed.impacts || [];

    logger.info(`Impact analysis complete: ${impacts.length} items analyzed`);
    return impacts;
  } catch (error) {
    handleAPIError(error);
    return [];
  }
}
