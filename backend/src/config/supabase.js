import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

let supabaseClient = null;

if (config.supabaseUrl && config.supabaseKey && !config.supabaseUrl.includes('tu-proyecto')) {
  supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);
} else {
  console.warn('⚠️ Supabase credentials not fully configured. Using mock/in-memory fallback when Supabase is unreachable.');
}

export const supabase = supabaseClient;

