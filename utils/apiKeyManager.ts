/**
 * Utility module for managing API keys in browser environment
 */

interface ApiKeyConfig {
  keyName: string;
  envVarNames: string[];
  instructionsUrl: string;
}

/**
 * Retrieves and validates API key from environment variables
 */
export const getApiKey = (): string | null => {
  // @ts-ignore - Vite injects process.env at build time
  const rawKey = typeof process !== 'undefined' && process.env 
    ? (process.env.API_KEY || process.env.OPENAI_API_KEY)
    : undefined;

  return isValidApiKey(rawKey) ? (rawKey as string).trim() : null;
};

/**
 * Validates if a value is a valid API key
 */
const isValidApiKey = (value: unknown): boolean => {
  return (
    typeof value === 'string' &&
    value !== 'undefined' &&
    value !== 'null' &&
    value !== '' &&
    value.trim().length > 0
  );
};

/**
 * Logs API key status (only in browser)
 */
export const logApiKeyStatus = (apiKey: string | null, config: ApiKeyConfig): void => {
  if (typeof window === 'undefined') return;

  if (!apiKey) {
    console.warn(`⚠️ ${config.keyName} API key not found!`);
    console.warn('Please create a .env.local file in the project root with:');
    console.warn(`${config.envVarNames[0]}=your_api_key_here`);
    console.warn('Then restart your dev server (npm run dev)');
    console.warn(`Get your API key from: ${config.instructionsUrl}`);
  } else {
    console.log(`✅ ${config.keyName} API key loaded`);
  }
};

