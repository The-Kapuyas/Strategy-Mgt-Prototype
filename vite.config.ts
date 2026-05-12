import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Safely load env - handle case where .env.local doesn't exist
    let env: Record<string, string> = {};
    try {
      env = loadEnv(mode, '.', '');
    } catch (error) {
      // .env.local might not exist, that's okay
      console.warn('Note: Could not load .env.local (this is okay if file doesn\'t exist yet)');
    }
    
    const openaiApiKey = env.OPENAI_API_KEY || '';
    
    if (!openaiApiKey && mode === 'development') {
      console.warn('⚠️  OPENAI_API_KEY not found in .env.local');
      console.warn('   Create .env.local with: OPENAI_API_KEY=your_key_here');
    }
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Only inject API key in development — in production builds the serverless proxy handles it
        'process.env.API_KEY': mode !== 'production' && openaiApiKey ? JSON.stringify(openaiApiKey) : 'undefined',
        'process.env.OPENAI_API_KEY': mode !== 'production' && openaiApiKey ? JSON.stringify(openaiApiKey) : 'undefined',
        'import.meta.env.VITE_OPENAI_API_KEY': mode !== 'production' && openaiApiKey ? JSON.stringify(openaiApiKey) : 'undefined',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
