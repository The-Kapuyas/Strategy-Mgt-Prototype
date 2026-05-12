// App Configuration
export const APP_CONFIG = {
  TOTAL_STEPS: 4, // Onboarding steps (0-3) + Workspace (4)
  COMPANY_NAME_DEFAULT: '',
  APP_TITLE: 'Pulley Strategy Workspace',
} as const;

// API Configuration
export const API_CONFIG = {
  MODEL: 'gpt-4o',
  TEMPERATURE: 0.7,
  SYSTEM_PROMPT: 'You are an expert OKR coach and strategic planning consultant. You help companies create effective Objectives and Key Results following industry best practices. Respond with valid JSON only. Do not include markdown code blocks or explanations.',
} as const;

// OKR Best Practices Guidelines
export const OKR_GUIDELINES = {
  OBJECTIVES: {
    description: 'Objectives should be qualitative, inspiring, and time-bound',
    examples: [
      'Become the market leader in equity management',
      'Delight customers with world-class support',
      'Build a high-performance engineering culture',
    ],
    rules: [
      'Keep it qualitative - no numbers in objectives',
      'Make it inspiring and memorable',
      'Should be achievable in the time period',
      'Limit to 3-5 objectives per period',
    ],
  },
  KEY_RESULTS: {
    description: 'Key Results should be quantitative, measurable, and specific',
    examples: [
      'Increase NPS from 40 to 60',
      'Reduce customer churn from 5% to 2%',
      'Launch 3 new product features',
      'Achieve $10M ARR',
    ],
    rules: [
      'Must be measurable with a number',
      'Should have a clear target and baseline',
      '70% completion is considered success',
      'Limit to 3-5 key results per objective',
    ],
  },
} as const;

// Project Status
export const PROJECT_STATUS = {
  TODO: 'To Do',
  DOING: 'Doing',
  DONE: 'Done',
} as const;

export type ProjectStatus = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];

// Progress Values
export const PROGRESS_VALUES = {
  TODO: 0,
  DOING: 10,
  DONE: 100,
} as const;

// Status Colors
export const STATUS_COLORS = {
  [PROJECT_STATUS.DONE]: 'bg-emerald-500',
  [PROJECT_STATUS.DOING]: 'bg-amber-400',
  [PROJECT_STATUS.TODO]: 'bg-slate-300',
} as const;

// Step Labels - Updated for OKR framework (only onboarding steps shown in stepper)
export const STEP_LABELS = [
  'Welcome',
  'Objectives',
  'Key Results',
  'Team',
] as const;

// Logging Configuration
export const ENABLE_DEBUG_LOGS = import.meta.env.DEV; // Only in development
