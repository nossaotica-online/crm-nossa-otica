import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';

let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Configuração pública do Supabase ausente.');
  }

  browserClient = createSupabaseClient(supabaseUrl, publishableKey, {
    auth: {
      // Em um site 100% estático não existe servidor capaz de emitir cookie
      // HttpOnly. O supabase-js usa localStorage e evita simular segurança SSR
      // com um cookie que continuaria acessível por JavaScript.
      persistSession: true,
      autoRefreshToken: true,
      // Necessário para consumir com segurança o link de recuperação de senha.
      detectSessionInUrl: true,
      storageKey: 'nossa-otica-auth',
    },
  });

  return browserClient;
}
