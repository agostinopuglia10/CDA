// ============================================================
// Configurazione Supabase
//
// COME ATTIVARLA:
// 1. Crea un progetto su supabase.com (gratuito)
// 2. Vai su Project Settings > API
// 3. Copia "Project URL" e incollalo in SUPABASE_URL qui sotto
// 4. Copia la chiave "anon public" e incollala in SUPABASE_ANON_KEY
//    (NON usare mai la "service_role key" qui: quella va tenuta segreta
//    e usata solo lato server, mai in un file caricato dal browser)
// ============================================================

const SUPABASE_URL = 'https://udynqqqxjcyhdeygqumi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xjJru5AOW6V242H2L7rZTg_Lg6zXYw5';

let supabaseClient = null;

if (
  typeof window.supabase !== 'undefined' &&
  SUPABASE_URL.indexOf('YOUR-PROJECT') === -1 &&
  SUPABASE_ANON_KEY.indexOf('YOUR-ANON-PUBLIC-KEY') === -1
) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
