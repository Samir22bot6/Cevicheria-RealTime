import { GoogleGenAI } from '@google/genai';
import { config } from './env.js';

let aiInstance = null;

if (config.geminiApiKey && !config.geminiApiKey.includes('tu-gemini')) {
  aiInstance = new GoogleGenAI({ apiKey: config.geminiApiKey });
} else {
  console.warn('⚠️ GEMINI_API_KEY no configurada. Se utilizará un motor de recomendaciones de respaldo en caso de ser necesario.');
}

export const ai = aiInstance;

