// ============================================================
// Edge Function: backup-database
//
// COSA FA:
// Il piano Supabase in uso oggi è "free" e non include backup
// automatici affidabili del database. Questa funzione fa un backup
// "fatto in proprio", gratuito: ogni settimana (vedi pg_cron nella
// migrazione 014) esporta le tabelle importanti in un unico file JSON
// e lo salva nello Storage di Supabase (bucket privato "backups").
// Tiene solo gli ultimi 8 backup (~2 mesi), cancellando i più vecchi,
// per non riempire lo spazio gratuito.
//
// Non sostituisce un backup professionale (es. point-in-time recovery
// del piano Pro) — è una rete di sicurezza minima contro un errore
// umano o un bug che cancelli/rovini dei dati, a costo zero.
//
// COME RECUPERARE UN BACKUP IN CASO DI PROBLEMA:
// Supabase Dashboard → Storage → bucket "backups" → scarica il file
// JSON più recente prima del problema. Contiene un array per ogni
// tabella con tutte le righe di quel momento — da reinserire a mano
// (o chiedendo aiuto) se mai serve un ripristino.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TABLES = [
  'products',
  'categories',
  'bundle_items',
  'product_attributes',
  'orders',
  'order_items',
  'quote_requests',
  'newsletter_signups',
  'testimonials',
  'site_settings',
  'social_posts',
];

const KEEP_LAST = 8;

Deno.serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const snapshot: Record<string, unknown> = { created_at: new Date().toISOString() };
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) {
        return new Response(JSON.stringify({ error: `Errore lettura ${table}: ${error.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      snapshot[table] = data;
    }

    const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, JSON.stringify(snapshot, null, 2), { contentType: 'application/json' });

    if (uploadError) {
      return new Response(JSON.stringify({ error: 'Errore salvataggio backup: ' + uploadError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pulizia: tiene solo gli ultimi KEEP_LAST backup.
    const { data: existing } = await supabase.storage.from('backups').list('', { limit: 1000 });
    const sorted = (existing || [])
      .filter((f) => f.name.startsWith('backup-'))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
    const toDelete = sorted.slice(KEEP_LAST).map((f) => f.name);
    if (toDelete.length > 0) {
      await supabase.storage.from('backups').remove(toDelete);
    }

    return new Response(
      JSON.stringify({ ok: true, file: fileName, tables: TABLES.length, deleted_old: toDelete.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Errore sconosciuto' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
