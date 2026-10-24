// ============================================================
// Edge Function: newsletter-unsubscribe
//
// Link pubblico cliccabile da dentro le email (nessun login):
// /functions/v1/newsletter-unsubscribe?token=...
// Marca l'iscritto come disiscritto (unsubscribed_at) — la riga resta
// nel database per lo storico, ma non riceverà più nessuna newsletter.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  const page = (title: string, message: string) => new Response(
    `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>body{font-family:Arial,sans-serif;background:#F7F5F2;color:#1B1B1D;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;}
    .card{max-width:420px;background:#fff;border:1px solid #E4E1DB;padding:32px;text-align:center;}
    h1{font-size:20px;margin:0 0 12px;}p{color:#6E7276;font-size:14.5px;line-height:1.5;}
    a{color:#D2131A;}</style></head>
    <body><div class="card"><h1>${title}</h1><p>${message}</p><p><a href="https://cda-camper.it">Torna al sito →</a></p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );

  if (!token) return page('Link non valido', 'Manca il codice di disiscrizione nel link.');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('newsletter_signups')
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .is('unsubscribed_at', null)
    .select('email')
    .maybeSingle();

  if (error || !data) {
    return page('Fatto', 'Questo indirizzo risulta già disiscritto (o il link non è più valido).');
  }

  return page('Disiscrizione completata', `${data.email} non riceverà più le nostre email. Puoi iscriverti di nuovo in qualsiasi momento dal sito.`);
});
