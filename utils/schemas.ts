import { JSONSchema } from '../types/api';

/**
 * Reusable JSON schemas for AI API requests
 * Updated for OKR (Objectives and Key Results) framework
 */

export const createArraySchema = (itemType: string, description?: string): JSONSchema => ({
  type: 'array',
  items: { type: itemType },
  ...(description && { description }),
});

export const createObjectArraySchema = (
  properties: Record<string, any>,
  required: string[],
  description?: string
): JSONSchema => ({
  type: 'array',
  items: {
    type: 'object',
    properties,
    required,
  },
  ...(description && { description }),
});

export const SCHEMAS = {
  companyResearch: {
    type: 'object',
    properties: {
      companyDescription: { type: 'string', description: 'Brief description of what the company does' },
      industry: { type: 'string', description: 'Primary industry or sector' },
      stage: { type: 'string', description: 'Company stage (startup, growth, enterprise, etc.)' },
      products: createArraySchema('string', 'Main products or services offered'),
      targetMarket: { type: 'string', description: 'Target market or customer segment' },
      competitors: createArraySchema('string', 'Key competitors in the space'),
      challenges: createArraySchema('string', 'Common challenges companies in this space face'),
      opportunities: createArraySchema('string', 'Growth opportunities in this market'),
    },
    required: ['companyDescription', 'industry', 'stage', 'products', 'targetMarket', 'challenges', 'opportunities'],
  } as JSONSchema,

  /**
   * Objectives Schema - Following OKR best practices
   * Objectives should be qualitative, inspiring, and time-bound
   * Includes reasoning for explainability
   */
  objectives: {
    type: 'object',
    properties: {
      objectives: createObjectArraySchema(
        {
          title: { type: 'string', description: 'The objective statement' },
          reasoning: { type: 'string', description: 'Brief explanation of why this objective is relevant based on company research and context (1-2 sentences)' },
        },
        ['title', 'reasoning'],
        'Array of 3-5 qualitative, inspiring objectives with explanations'
      ),
      overallRationale: { type: 'string', description: 'A brief summary explaining the overall strategy behind these objective suggestions (2-3 sentences)' },
    },
    required: ['objectives', 'overallRationale'],
  } as JSONSchema,

  /**
   * Key Results Schema - Following OKR best practices
   * Key Results should be quantitative, measurable, and specific
   * Includes reasoning for explainability
   */
  keyResults: {
    type: 'object',
    properties: {
      keyResults: createObjectArraySchema(
        {
          title: { type: 'string', description: 'The key result statement with a measurable target' },
          metric: { type: 'string', description: 'The specific metric being measured (e.g., "NPS score", "revenue", "customer count")' },
          target: { type: 'string', description: 'The target value to achieve (e.g., "60", "$10M", "100 customers")' },
          reasoning: { type: 'string', description: 'Brief explanation of why this metric and target were chosen (1-2 sentences)' },
        },
        ['title', 'metric', 'target', 'reasoning'],
        'Array of 3-5 measurable key results with specific targets and explanations'
      ),
    },
    required: ['keyResults'],
  } as JSONSchema,

  // Legacy alias for backward compatibility
  priorities: {
    type: 'object',
    properties: {
      priorities: createArraySchema('string', 'Array of 3-5 qualitative objectives'),
    },
    required: ['priorities'],
  } as JSONSchema,

  // Legacy alias for backward compatibility
  initiatives: {
    type: 'object',
    properties: {
      initiatives: createArraySchema('string', 'Array of 2-3 measurable key results'),
    },
    required: ['initiatives'],
  } as JSONSchema,

  resources: {
    type: 'object',
    properties: {
      resources: createObjectArraySchema(
        {
          label: { type: 'string' },
          value: { type: 'string' },
          reasoning: { type: 'string', description: 'Brief explanation for this resource recommendation' },
        },
        ['label', 'value', 'reasoning'],
        'Array of resource requirements with explanations'
      ),
      summary: { type: 'string', description: 'Brief overall rationale for the resource allocation strategy' },
    },
    required: ['resources', 'summary'],
  } as JSONSchema,

  projectResources: {
    type: 'object',
    properties: {
      timeframe: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Project start date in ISO format (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'Project end date in ISO format (YYYY-MM-DD)' },
          durationMonths: { type: 'number', description: 'Duration in months' },
          reasoning: { type: 'string', description: 'Explanation for the suggested timeline' },
        },
        required: ['startDate', 'endDate', 'durationMonths', 'reasoning'],
      },
      headcount: createObjectArraySchema(
        {
          name: { type: 'string', description: 'Person name (from roster if available) or role description' },
          role: { type: 'string', description: 'Role/title for the project' },
          allocation: { type: 'string', description: 'Time allocation: Full-time, Part-time, or percentage' },
          reasoning: { type: 'string', description: 'Why this person/role is needed' },
        },
        ['name', 'role', 'allocation', 'reasoning'],
        'Array of headcount/team member suggestions'
      ),
      summary: { type: 'string', description: 'Brief overall rationale for the resource allocation' },
    },
    required: ['timeframe', 'headcount', 'summary'],
  } as JSONSchema,

  projects: {
    type: 'object',
    properties: {
      projects: createObjectArraySchema(
        {
          department: { type: 'string' },
          title: { type: 'string' },
          reasoning: { type: 'string', description: 'Brief explanation of why this project is needed and how it contributes to the key result' },
        },
        ['department', 'title', 'reasoning'],
        'Array of departmental projects with explanations'
      ),
    },
    required: ['projects'],
  } as JSONSchema,

  message: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  } as JSONSchema,

  leaderSuggestions: {
    type: 'object',
    properties: {
      items: createObjectArraySchema(
        {
          itemId: { type: 'string', description: 'The project or KR ID (e.g., P5, KR1.1)' },
          itemType: { type: 'string', description: 'Either "project" or "keyResult"' },
          itemLabel: { type: 'string', description: 'Human-readable name of the item' },
          suggestedStatus: { type: 'string', description: 'One of: on_track, at_risk, blocked, ahead, done' },
          rationale: { type: 'string', description: '2-3 sentence explanation of why this status was suggested, referencing specific data points' },
          flags: createArraySchema('string', 'Optional warning flags like "overallocation", "stale progress", "dependency risk", "timeline risk"'),
          proposedActions: createObjectArraySchema(
            {
              title: { type: 'string', description: 'Short action title (e.g., "Rebalance staffing baseline", "Clarify priority conflict")' },
              description: { type: 'string', description: '2-3 sentence explanation of the issue and recommended direction, referencing specific evidence' },
              bullets: createArraySchema('string', 'Key supporting data points or sub-actions (2-4 bullets)'),
              affectedEntityIds: createArraySchema('string', 'IDs of affected projects, KRs, or personnel (e.g., ["P5", "KR2.1"])'),
              affectedEntityLabels: createArraySchema('string', 'Human-readable names corresponding to affectedEntityIds'),
              severity: { type: 'string', description: 'One of: critical, warning, info' },
            },
            ['title', 'description', 'bullets', 'affectedEntityIds', 'affectedEntityLabels', 'severity'],
            'High-level directional recommendations for items that need attention. Do NOT include specific field-level mutations — those will be refined through follow-up conversation. Include 1-3 actions per at-risk/blocked item.'
          ),
          detailedAnalysis: {
            type: 'object',
            description: 'For at-risk or blocked key result items: a structured assessment along three dimensions. Omit for on_track/ahead/done items.',
            properties: {
              outcome: {
                type: 'object',
                description: 'Whether the KR is currently where it should be relative to plan.',
                properties: {
                  status: { type: 'string', description: 'One of: on_target, partial, missed' },
                  bullets: createArraySchema('string', 'Evidence bullets with **bold**, P1/KR2.1 refs, and [text](url) citations'),
                },
                required: ['status', 'bullets'],
              },
              time: {
                type: 'object',
                description: 'Whether the KR still has enough runway to land by the deadline.',
                properties: {
                  status: { type: 'string', description: 'One of: on_time, delayed, overdue' },
                  bullets: createArraySchema('string', 'Evidence bullets with **bold**, P1/KR2.1 refs, and [text](url) citations'),
                },
                required: ['status', 'bullets'],
              },
              executionHealth: {
                type: 'object',
                description: 'Whether supporting projects, owners, and dependencies are healthy enough to deliver the KR.',
                properties: {
                  status: { type: 'string', description: 'One of: stable, watch, at_risk' },
                  bullets: createArraySchema('string', 'Evidence bullets with **bold**, P1/KR2.1 refs, and [text](url) citations'),
                },
                required: ['status', 'bullets'],
              },
            },
            required: ['outcome', 'time', 'executionHealth'],
          },
          verboseAssessment: { type: 'string', description: 'DEPRECATED — use detailedAnalysis instead. Fallback free-form markdown assessment for older data.' },
          citedSourceDocumentIds: createArraySchema('string', 'IDs of source documents cited in the detailedAnalysis or verboseAssessment.'),
        },
        ['itemId', 'itemType', 'itemLabel', 'suggestedStatus', 'rationale'],
        'One entry per project or KR in the leader\'s portfolio'
      ),
      summary: { type: 'string', description: '2-3 sentence overall assessment of this leader\'s portfolio health' },
    },
    required: ['items', 'summary'],
  } as JSONSchema,

  insights: {
    type: 'object',
    properties: {
      summary: { type: 'string' },
      risks: createObjectArraySchema(
        {
          risk: { type: 'string', description: 'The identified risk' },
          reasoning: { type: 'string', description: 'Why this is a risk based on the OKR data' },
        },
        ['risk', 'reasoning'],
        'Array of potential risks with explanations'
      ),
      focusAreas: createObjectArraySchema(
        {
          area: { type: 'string', description: 'The focus area recommendation' },
          reasoning: { type: 'string', description: 'Why this should be prioritized' },
        },
        ['area', 'reasoning'],
        'Array of focus areas with explanations'
      ),
    },
    required: ['summary', 'risks', 'focusAreas'],
  } as JSONSchema,
};
