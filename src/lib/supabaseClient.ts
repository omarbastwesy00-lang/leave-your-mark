import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigDebug = {
  url: supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : null,
  anonKeyPreview: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 12)}...` : null,
  isConfigured: isSupabaseConfigured,
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
