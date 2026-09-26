import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigDebug = {
  url: supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : null,
  anonKeyPreview: supabaseAnonKey ? `${supabaseAnonKey.slice(0, 12)}...` : null,
  isConfigured: isSupabaseConfigured,
};

const SUPABASE_REQUEST_TIMEOUT = 30000;
const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SUPABASE_REQUEST_TIMEOUT);
  const externalAbort = () => controller.abort();
  init?.signal?.addEventListener("abort", externalAbort, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
    init?.signal?.removeEventListener("abort", externalAbort);
  }
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: fetchWithTimeout },
    })
  : null;
